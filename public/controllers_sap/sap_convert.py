import os
import json
import datetime
from flask import Blueprint, request, jsonify
from controllers_sap.sap_service import SAPServiceLayer
from bd import get_connection

sap_convert_bp = Blueprint("sap_convert_bp", __name__)

# ==========================================================
# 🔹 CONVERTIR SOLICITUD → PEDIDO
# ==========================================================
@sap_convert_bp.route("/sap/convertir_a_pedido", methods=["POST"])
def convertir_a_pedido():
    """
    Convierte una Solicitud de Compra en un Pedido de Compra en SAP,
    actualiza la BD local (NUMERO_PEDIDO en FACTURAS)
    y recalcula el DETALLE_PRODUCTO con los impuestos unitarios truncados a 2 decimales.
    """

    try:
        data = request.get_json()
        base_entry = data.get("DocEntry")  # DocEntry de la solicitud SAP
        card_code = data.get("CardCode", "PN99520000-7")

        if not base_entry:
            return jsonify({"status": "error", "mensaje": "Falta DocEntry de la solicitud"}), 400

        # === Conexión SAP ===
        sap = SAPServiceLayer()
        sap.login()

        # === Obtener solicitud desde SAP ===
        ok, solicitud = sap.get(f"PurchaseRequests({base_entry})")
        if not ok or not solicitud:
            sap.logout()
            return jsonify({
                "status": "error",
                "mensaje": f"No se encontró la solicitud {base_entry} en SAP"
            }), 404

        solicitud_num = solicitud.get("DocNum")
        print(f"📋 Convirtiendo Solicitud {solicitud_num} → Pedido...")

        # === Crear payload del pedido ===
        fecha_hoy = datetime.datetime.now()
        payload = {
            "DocDate": fecha_hoy.strftime("%Y-%m-%d"),
            "DocDueDate": (fecha_hoy + datetime.timedelta(days=30)).strftime("%Y-%m-%d"),
            "CardCode": card_code,
            "Comments": f"Pedido generado automáticamente desde Solicitud {solicitud_num}",
            "DocumentLines": [
                {
                    "BaseType": 1470000113,  # Tipo base: Solicitud de compra
                    "BaseEntry": solicitud["DocEntry"],
                    "BaseLine": linea["LineNum"],
                    "ItemCode": linea["ItemCode"],
                    "Quantity": linea["Quantity"],
                    "WarehouseCode": linea["WarehouseCode"],
                    "TaxCode": linea["TaxCode"]
                }
                for linea in solicitud.get("DocumentLines", [])
            ]
        }

        # === Crear pedido en SAP ===
        ok, resp = sap.post("PurchaseOrders", payload)
        if not ok:
            print("❌ Error al crear pedido:", resp)
            sap.logout()
            return jsonify({"status": "error", "mensaje": "Error al crear pedido en SAP"}), 500

        pedido_docnum = resp.get("DocNum")
        pedido_docentry = resp.get("DocEntry")
        print(f"✅ Pedido SAP creado correctamente → DocNum={pedido_docnum}")

        # === Actualizar FACTURAS con NUMERO_PEDIDO ===
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE FACTURAS
                SET NUMERO_PEDIDO = ?
                WHERE NUMERO_SOLICITUD_SAP = ?
            """, (str(pedido_docnum), str(solicitud_num)))
            conn.commit()
            print(f"🗃️ FACTURAS.NUMERO_PEDIDO actualizado → {pedido_docnum}")
        except Exception as e:
            print(f"⚠️ Error actualizando NUMERO_PEDIDO en FACTURAS: {e}")
        finally:
            cursor.close()
            conn.close()

        # === Calcular y actualizar DETALLE_PRODUCTO ===
        try:
            conn = get_connection()
            cursor = conn.cursor()

            # Buscar tanto por NUMERO_SOLICITUD_SAP como por NUMERO_PEDIDO
            cursor.execute("""
                SELECT TOP 1 ID_FACTURA, BASE_AFECTA, IEV, IEF, TOTAL
                FROM FACTURAS
                WHERE NUMERO_SOLICITUD_SAP = ? OR NUMERO_PEDIDO = ?
            """, (str(solicitud_num), str(pedido_docnum)))
            factura = cursor.fetchone()

            if factura:
                id_factura = int(factura[0])
                base_afecta = float(factura[1] or 0)
                iev_total = float(factura[2] or 0)
                ief_total = float(factura[3] or 0)
                total_factura = float(factura[4] or 0)

                cantidad = float(solicitud["DocumentLines"][0]["Quantity"])
                id_producto = 3 

                if cantidad > 0:
                    # Truncar sin redondear
                    def truncar_4(x):
                        s = f"{x:.10f}"
                        return float(s[:s.find('.') + 5]) if '.' in s else float(s)

                    pbase_si_u = truncar_4(base_afecta / cantidad)
                    iev_u = truncar_4(iev_total / cantidad)
                    ief_u = truncar_4(ief_total / cantidad)
                    ptotal_u = truncar_4(pbase_si_u + iev_u + ief_u)
                    subtotal = truncar_4(ptotal_u * cantidad)

                    # Verificar si ya existe detalle
                    cursor.execute("SELECT COUNT(*) FROM DETALLE_PRODUCTO WHERE ID_FACTURA = ?", (id_factura,))
                    existe = cursor.fetchone()[0]

                    if existe:
                        cursor.execute("""
                            UPDATE DETALLE_PRODUCTO
                            SET CANTIDAD = ?, PBASE_SI_U = ?, IEV_U = ?, IEF_U = ?, 
                                PTOTAL_U = ?, SUBTOTAL = ?, ID_PRODUCTO = ?
                            WHERE ID_FACTURA = ?
                        """, (cantidad, pbase_si_u, iev_u, ief_u, ptotal_u, subtotal, id_producto, id_factura))
                        print(f"🔁 DETALLE_PRODUCTO actualizado → Factura={id_factura}, Subtotal={subtotal}")
                    else:
                        cursor.execute("""
                            INSERT INTO DETALLE_PRODUCTO 
                                (CANTIDAD, PBASE_SI_U, IEV_U, IEF_U, PTOTAL_U, SUBTOTAL, ID_PRODUCTO, ID_FACTURA)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (cantidad, pbase_si_u, iev_u, ief_u, ptotal_u, subtotal, id_producto, id_factura))
                        print(f"🧾 DETALLE_PRODUCTO creado → Factura={id_factura}, Subtotal={subtotal}")

                    conn.commit()
            conn.close()

        except Exception as e:
            print(f"⚠️ Error al actualizar DETALLE_PRODUCTO: {e}")
            conn.rollback()

        # === Cerrar sesión SAP ===
        sap.logout()

        # === Respuesta final ===
        return jsonify({
            "status": "ok",
            "mensaje": f"Solicitud {solicitud_num} convertida a Pedido {pedido_docnum}, detalle actualizado correctamente.",
            "data": {
                "DocNumPedido": pedido_docnum,
                "DocEntryPedido": pedido_docentry
            }
        }), 200

    except Exception as e:
        print(f"❌ Error general en conversión a pedido: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500
