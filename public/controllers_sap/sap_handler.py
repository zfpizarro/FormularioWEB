import datetime
import json
import os
import shutil
import urllib3
import requests
from flask import Blueprint, request, jsonify
from bd import get_connection

from controllers.validations import (
    parse_fecha,
    validar_estanques,
    litros_totales_factura,
    registrar_log
)
from controllers_sap.sap_service import SAPServiceLayer
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

insert_bp = Blueprint("insert_bp", __name__)
sap_bp = Blueprint("sap_bp", __name__)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))  
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

OUTSTANDING_DIR = os.path.join(PUBLIC_DIR, "outstanding")
UPLOADS_DIR = os.path.join(PUBLIC_DIR, "uploads")


@insert_bp.route("/insert_factura", methods=["POST"])
def insert_factura():
    """
    Inserta una factura procesada por OCR en la BD local,
    incluyendo la distribución de estanques y el número de solicitud SAP.
    """
    try:
        payload = request.get_json()
        if not payload or "Factura" not in payload:
            return jsonify({"error": "No se recibió 'Factura' en el payload"}), 400

        factura = payload["Factura"]
        distribuciones = payload.get("Distribuciones", [])
        numero_solicitud_sap = payload.get("NUMERO_SOLICITUD_SAP")

        # === Validaciones de distribución ===
        if not distribuciones or all(d.get("liters", 0) <= 0 for d in distribuciones):
            return jsonify({"error": "Debe asignar al menos un estanque con litros > 0"}), 400

        ok_stk, msg_stk = validar_estanques(distribuciones)
        if not ok_stk:
            return jsonify({"error": msg_stk}), 400

        total_distribuido = sum(d["liters"] for d in distribuciones)
        total_factura = litros_totales_factura(factura)

        if abs(total_distribuido - total_factura) > 0.001:
            return jsonify({
                "status": "rechazado",
                "mensaje": (f"La distribución total ({total_distribuido} L) no coincide con los litros de la factura "
                            f"({total_factura} L)."),
                "esperado": total_factura,
                "asignado": total_distribuido
            }), 400

        # === Datos de auditoría ===
        fecha_ingreso = datetime.date.today()
        hora_ingreso = datetime.datetime.now().strftime("%H:%M:%S")
        usuario_ingreso = "usuario_prueba"

        conn = get_connection()
        cur = conn.cursor()

        # === Insertar factura ===
        detalle_pago = factura.get("Detalle de Pago", {})
        cur.execute("""
            INSERT INTO FACTURAS (
                NUMERO_FACTURA, NUMERO_SOLICITUD_SAP, FECHA_EMISION,
                RUT_EMISOR, NOMBRE_EMISOR,
                RUT_RECEPTOR, NOMBRE_RECEPTOR, DIRECCION_RECEPTOR, DESPACHO_RECEPTOR,
                BASE_AFECTA, FEEP, IEV, IEF, IVA, TOTAL,
                USUARIO_INGRESO, FECHA_INGRESO, HORA_INGRESO
            )
            OUTPUT INSERTED.ID_FACTURA
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            factura.get("Número de factura"),
            numero_solicitud_sap,
            parse_fecha(factura.get("FECHA_EMISION")),
            factura.get("RUT_EMISOR"),
            factura.get("Empresa del combustible"),
            factura.get("RUT_RECEPTOR", 
                        "78.801.520-8"),
            factura.get("Nombre_Receptor"),
            factura.get("DIRECCION_RECEPTOR",
                        "AV. TALCA Nº 101, ALTO PENUELAS"),
            factura.get("Despacho_Receptor"),
            
            detalle_pago.get("Base Afecta"),
            detalle_pago.get("FEEP"),
            detalle_pago.get("IEV"),
            detalle_pago.get("IEF"),
            detalle_pago.get("IVA"),
            detalle_pago.get("Total"),
            usuario_ingreso,
            fecha_ingreso,
            hora_ingreso
        ))

        id_factura = cur.fetchone()[0]


        for det in (factura.get("Detalle de productos") or []):
            det_normalizado = {k.replace(" ", "_"): v for k, v in det.items()}

            nombre_producto = det_normalizado.get("Nombre_del_producto", "SIN NOMBRE")

            cur.execute("SELECT ID_PRODUCTO FROM PRODUCTO WHERE NOMBRE_PRODUCTO = ?", nombre_producto)
            row = cur.fetchone()
            if row:
                id_producto = row[0]
            else:
                cur.execute(
                    "INSERT INTO PRODUCTO (NOMBRE_PRODUCTO) OUTPUT INSERTED.ID_PRODUCTO VALUES (?)",
                    nombre_producto
                )
                id_producto = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO DETALLE_PRODUCTO (
                    CANTIDAD, PBASE_SI_U, IEV_U, IEF_U, PTOTAL_U, SUBTOTAL, ID_PRODUCTO, ID_FACTURA
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                det_normalizado.get("Cantidad_(litros)", 0),
                det_normalizado.get("PBASE_SI_U", 0),
                det_normalizado.get("IEV_U", 0),
                det_normalizado.get("IEF_U", 0),
                det_normalizado.get("PTOTAL_U", 0),
                det_normalizado.get("SUBTOTAL_U", 0),
                id_producto,
                id_factura
            ))

        # === Distribuciones ===
        for dist in distribuciones:
            cur.execute("""
                INSERT INTO DISTRIBUCIONES (ID_FACTURA, ID_ESTANQUE, LITROS_ASIGNADOS)
                VALUES (?, ?, ?)
            """, (id_factura, dist["tank"], dist["liters"]))

        conn.commit()
            # === MOVER PDF SOLO SI SAP Y BD FUERON EXITOSOS ===
        try:
            numero_factura = factura.get("Número de factura")
            if numero_factura:
                pdf_name = f"{numero_factura}.pdf"
                origen = os.path.join(r"C:\Users\fpizarro\Desktop\Excelsior\Outstanding", pdf_name)
                destino = os.path.join(r"C:\Users\fpizarro\Desktop\Excelsior\Uploads", pdf_name)
                if os.path.exists(origen):
                    shutil.move(origen, destino)
                    print(f"✅ PDF movido a Uploads tras SAP y BD correctos → {destino}")
                else:
                    print(f"⚠️ PDF no encontrado: {origen}")
        except Exception as move_err:
            print(f"⚠️ No se pudo mover PDF tras insert_factura: {move_err}")


        conn.close()

        return jsonify({
            "status": "ok",
            "mensaje": f"Factura {factura.get('Número de factura')} insertada correctamente con Solicitud SAP {numero_solicitud_sap}",
            "id_factura": id_factura
        }), 200
    
    

    except Exception as e:
        print(f"❌ Error insert_factura: {e}")
        return jsonify({"error": str(e)}), 500

@sap_bp.route("/sap/crear_solicitud_compra", methods=["POST"])
def crear_solicitud_compra_route():
    """
    Recibe un JSON desde React con los datos de la solicitud,
    crea la Solicitud de Compra en SAP, y si es exitosa:
      - Mueve el PDF desde Outstanding a Uploads
      - Renombra el archivo con el número de solicitud (DocNum)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "mensaje": "No se recibió payload"}), 400

        print("📥 [SAP] Recibiendo solicitud de compra...")

        doc_lines = data.get("DocumentLines", [])
        source_pdf = data.get("source_pdf")  
        requester = data.get("DESCAMILLA")

        if not doc_lines:
            return jsonify({"status": "error", "mensaje": "No hay líneas de documento"}), 400

        linea = doc_lines[0]

        fecha_hoy = datetime.datetime.now().strftime("%Y-%m-%d")
        fecha_vencimiento = (datetime.datetime.now() + datetime.timedelta(days=30)).strftime("%Y-%m-%d")


        # === Normalizar almacén antes de enviar a SAP ===
        whs_raw = (linea.get("WarehouseCode") or "").upper()

        # Mapa de nombres → códigos SAP
        almacenes_map = {
            "BODEGA SAN ANTONIO": "BOD_SAN",
            "SAN ANTONIO": "BOD_SAN",
            "QUEBRADA SAN ANTONIO": "BOD_SAN",
            "BODEGA LAMBERT": "BOD_LAM",
            "LAMBERT": "BOD_LAM",
            "AGUA GRANDE": "BOD_LAM",
            "BODEGA TALCUNA": "BOD_TAL",
            "TALCUNA": "BOD_TAL",
            "MOLLE": "BOD_TAL",
            "MARQUESA": "BOD_TAL",
        }

        warehouse_code = almacenes_map.get(whs_raw)  
        payload = {
            "DocDate": fecha_hoy,
            "DocDueDate": fecha_vencimiento,
            "RequriedDate": fecha_hoy,
            "Requester": requester,
            "DocCurrency": "CLP",
            "Comments": f"Solicitud automática desde OCR)",
            "DocumentLines": [
                {
                    "ItemCode": linea.get("ItemCode"),
                    "Quantity": float(linea.get("Quantity")),
                    "Price": "0",
                    "TaxCode": linea.get("TaxCode"),
                    "WarehouseCode": warehouse_code,
                    "LineVendor": linea.get("LineVendor"),
                    "RequiredDate": fecha_hoy,
                    "Currency": "CLP",
                    "UoMCode": "Manual",
                    "MeasureUnit": "Litro",
                    "AccountCode": "1160304",
                }
            ],
        }

        print("\n📦 Payload final a enviar a SAP:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))

        sap = SAPServiceLayer()
        sap.login()
        ok, response = sap.post("PurchaseRequests", payload)

        if not ok:
            mensaje_error = response.get("error", {}).get("message", {}).get("value", "Error desconocido")
            registrar_log(None, "SAP_ERROR", mensaje_error)
            sap.logout()
            print(f"❌ Error POST SAP: {mensaje_error}")
            return jsonify({"status": "error", "mensaje": mensaje_error, "payload": payload}), 500

        # === Éxito ===
        doc_entry = response.get("DocEntry")
        doc_num = response.get("DocNum")

        print(f"✅ Solicitud creada correctamente en SAP (DocNum={doc_num})")
        registrar_log(doc_entry, "SAP_OK", f"Solicitud SAP creada exitosamente (DocNum {doc_num})")

        try:
            if source_pdf:
                origen = os.path.join(OUTSTANDING_DIR, source_pdf)
                if os.path.exists(origen):
                    nombre_original = os.path.basename(source_pdf)
                    
                    nombre_final = f"{doc_num}_{nombre_original}"
                    destino = os.path.join(UPLOADS_DIR, nombre_final)
                    if os.path.exists(destino):
                        base, ext = os.path.splitext(nombre_final)
                        count = 1
                        while os.path.exists(destino):
                            destino = os.path.join(UPLOADS_DIR, f"{base}_{count}{ext}")
                            count += 1

                    shutil.move(origen, destino)
                    print(f"✅ PDF movido y renombrado → {destino}")
                else:
                    print(f"⚠️ No se encontró el PDF en Outstanding: {origen}")
            else:
                print("⚠️ No se recibió 'source_pdf' en el payload, no se puede mover archivo.")
        except Exception as move_err:
            print(f"⚠️ Error moviendo PDF tras SAP OK: {move_err}")

        sap.logout()
        print("🔒 Sesión SAP cerrada correctamente.")

        return jsonify({
            "status": "ok",
            "DocNum": doc_num,
            "DocEntry": doc_entry,
            "mensaje": f"Solicitud creada correctamente (DocNum {doc_num})",
            "archivo_movido": True if source_pdf else False
        }), 200

    except Exception as e:
        print(f"❌ Error general en crear_solicitud_compra: {e}")
        registrar_log(None, "SAP_EXCEPTION", str(e))
        return jsonify({"status": "error", "mensaje": str(e)}), 500


# ==========================================================
# 🔹 ACTUALIZAR CÓDIGOS OCR EN SAP
# ==========================================================
@sap_bp.route("/sap/actualizar_codigos_ocr", methods=["POST"])
def actualizar_codigos_ocr():
    """
    Actualiza los campos de Centro de Costo (OcrCode), Área (OcrCode2)
    y Proceso (OcrCode3) de una Entrada de Mercancía en SAP.
    """
    try:
        data = request.get_json()
        doc_entry = data.get("DocEntry")
        ocr1 = data.get("CostingCode")
        ocr2 = data.get("CostingCode2")
        ocr3 = data.get("CostingCode3")

        if not doc_entry:
            return jsonify({"status": "error", "mensaje": "Falta DocEntry"}), 400

        sap = SAPServiceLayer()
        sap.login()
        payload = {"CostingCode": ocr1, "CostingCode2": ocr2, "CostingCode3": ocr3}
        ok, resp = sap.patch(f"PurchaseDeliveryNotes({doc_entry})", payload)
        sap.logout()

        if not ok:
            return jsonify({"status": "error", "mensaje": str(resp)}), 500

        print(f"✅ Códigos OCR actualizados correctamente para DocEntry={doc_entry}")
        return jsonify({"status": "ok", "mensaje": "Códigos OCR actualizados correctamente."}), 200

    except Exception as e:
        print(f"❌ Error en actualizar_codigos_ocr: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500
