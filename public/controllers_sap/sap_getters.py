

from flask import Blueprint, jsonify, request
from controllers_sap.sap_service import SAPServiceLayer
from bd import get_connection



sap_getters_bp = Blueprint("sap_getters_bp", __name__)


@sap_getters_bp.route("/pedidos_cerrados", methods=["GET"])
def pedidos_cerrados():
    """
    Retorna los pedidos cerrados (registrados en la tabla FACTURAS).
    Incluye valores base, impuestos y totales.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                NUMERO_PEDIDO,
                NOMBRE_EMISOR,       
                FECHA_EMISION,       
                BASE_AFECTA,
                IEF,
                IVA,
                TOTAL
            FROM FACTURAS
            WHERE NUMERO_PEDIDO IS NOT NULL
            ORDER BY FECHA_EMISION DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        data = [
            {
                "NUMERO_PEDIDO": r[0],
                "PROVEEDOR": r[1],
                "FECHA_FACTURA": r[2].strftime("%Y-%m-%d") if r[2] else None,
                "BASE_AFECTA": float(r[3] or 0),
                "IEF": float(r[4] or 0),
                "IVA": float(r[5] or 0),
                "TOTAL": float(r[6] or 0),
            }
            for r in rows
        ]

        return jsonify({"status": "ok", "data": data}), 200

    except Exception as e:
        print(f"❌ Error en /pedidos_cerrados: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500





@sap_getters_bp.route("/sap/items", methods=["GET"])
def get_items():
    try:
        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("Items?$select=ItemCode,ItemName,ForeignName")
        sap.logout()

        if ok and "value" in data:
            return jsonify([
                {
                    "ItemCode": i["ItemCode"],
                    "ItemName": i["ItemName"],
                    "ForeignName": i.get("ForeignName", "")
                }
                for i in data["value"]
            ])
        return jsonify({"error": "No se pudieron obtener artículos"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sap_getters_bp.route("/sap/vendors", methods=["GET"])
def get_vendors():
    try:
        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("BusinessPartners?$filter=CardType eq 'S'&$select=CardCode,CardName")
        sap.logout()

        if ok and "value" in data:
            return jsonify([
                {"CardCode": v["CardCode"], "CardName": v["CardName"]}
                for v in data["value"]
            ])
        return jsonify({"error": "No se pudieron obtener proveedores"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sap_getters_bp.route("/sap/warehouses", methods=["GET"])
def get_warehouses():
    try:
        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("Warehouses?$select=WarehouseCode,WarehouseName")
        sap.logout()

        if ok and "value" in data:
            return jsonify([
                {"WarehouseCode": w["WarehouseCode"], "WarehouseName": w["WarehouseName"]}
                for w in data["value"]
            ])
        return jsonify({"error": "No se pudieron obtener almacenes"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sap_getters_bp.route("/sap/taxcodes", methods=["GET"])
def get_taxcodes():
    try:
        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("VatGroups?$select=Code,Name")
        sap.logout()

        if ok and "value" in data:
            return jsonify([
                {"TaxCode": t["Code"], "TaxName": t["Name"]}
                for t in data["value"]
            ])
        return jsonify({"error": "No se pudieron obtener impuestos"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sap_getters_bp.route("/sap/last_request", methods=["GET"])
def get_last_request():
    try:
        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("PurchaseRequests?$orderby=DocNum desc&$top=1")
        sap.logout()

        if ok and "value" in data and len(data["value"]) > 0:
            last = data["value"][0]
            return jsonify({
                "DocNum": last.get("DocNum"),
                "DocEntry": last.get("DocEntry")
            })
        return jsonify({"DocNum": None, "DocEntry": None}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================================
# 🔹 FUNCIONES DE APOYO (para OCR / SAP_HANDLER)
# ==========================================================

def get_vendor_by_rut(rut: str):
    """Busca un proveedor en SAP por su RUT (CardCode o parte del nombre)."""
    try:
        rut_limpio = rut.replace(".", "").replace("-", "").strip()
        sap = SAPServiceLayer()
        sap.login()

        query = f"BusinessPartners?$filter=startswith(CardCode,'PN{rut_limpio}') or contains(CardName,'{rut_limpio}')&$select=CardCode,CardName"
        ok, data = sap.get(query)
        sap.logout()

        if ok and "value" in data and data["value"]:
            return data["value"][0]
    except Exception as e:
        print(f"⚠️ Error en get_vendor_by_rut: {e}")
    return None


def get_item_by_description(description: str):
    """Busca un artículo por su descripción."""
    try:
        sap = SAPServiceLayer()
        sap.login()

        desc_segura = description.replace("'", "''").strip().upper()
        endpoint = f"Items?$filter=substringof('{desc_segura}', ItemName)&$top=1"

        ok, data = sap.get(endpoint)
        sap.logout()

        if ok and data.get("value"):
            return data["value"][0]
    except Exception as e:
        print(f"⚠️ Error en get_item_by_description: {e}")
    return None


def get_warehouse_by_code(code: str):
    """Obtiene información de un almacén por su código (BT, BL, BS, etc.)."""
    try:
        code_upper = code.strip().upper()
        sap = SAPServiceLayer()
        sap.login()
        query = f"Warehouses?$filter=WarehouseCode eq '{code_upper}'&$select=WarehouseCode,WarehouseName"
        ok, data = sap.get(query)
        sap.logout()

        if ok and "value" in data and data["value"]:
            return data["value"][0]
    except Exception as e:
        print(f"⚠️ Error en get_warehouse_by_code: {e}")
    return None

# ==========================================================
# 🔹 DEBUG MAPA: Pedidos ↔ Solicitudes desde FACTURAS
# ==========================================================

@sap_getters_bp.route("/sap/mapa_pedido_solicitud", methods=["GET"])
def mapa_pedido_solicitud():
    """Devuelve el mapeo entre NUMERO_PEDIDO y NUMERO_SOLICITUD_SAP desde la tabla FACTURAS."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                TRY_CAST(NUMERO_PEDIDO AS INT) AS NUM_PEDIDO,
                TRY_CAST(NUMERO_SOLICITUD_SAP AS INT) AS NUM_SOLICITUD
            FROM FACTURAS
            WHERE ISNUMERIC(NUMERO_PEDIDO) = 1 AND ISNUMERIC(NUMERO_SOLICITUD_SAP) = 1
        """)
        data = cursor.fetchall()
        conn.close()

        relaciones = [
            {"pedido": int(r[0]), "solicitud": int(r[1])}
            for r in data if r[0] and r[1]
        ]

        return jsonify({
            "status": "ok",
            "data": relaciones
        }), 200

    except Exception as e:
        print(f"❌ Error en /sap/mapa_pedido_solicitud: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500

@sap_getters_bp.route("/sap/pedidos_abiertos", methods=["GET"])
def pedidos_abiertos():
    """
    Trae los pedidos abiertos desde SAP y agrega el número de solicitud SAP
    desde la tabla FACTURAS (NUMERO_SOLICITUD_SAP), comparando NUMERO_PEDIDO ↔ DocNum.
    """

    try:
        print("🔹 [DEBUG] Cargando pedidos abiertos desde SAP...")

        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("PurchaseOrders?$filter=DocumentStatus eq 'bost_Open'")
        sap.logout()

        if not ok or "value" not in data:
            return jsonify({"status": "error", "mensaje": "No se pudieron obtener pedidos desde SAP"}), 400

        # 1. Se crea la lista de pedidos de SAP
        pedidos = [
            {
                "DocEntry": p.get("DocEntry"),
                "DocNum": int(p.get("DocNum", 0)),
                "CardCode": p.get("CardCode"),
                "CardName": p.get("CardName"),
                "DocDate": p.get("DocDate"),
                "DocDueDate": p.get("DocDueDate"),
                "Moneda": p.get("DocCurrency", "CLP"),
                "Total": p.get("DocTotal", 0),
                "Estado": "Abierto",
                "tipo": "Pedido",
                "Lineas": [
                    {
                        "ItemCode": l.get("ItemCode"),
                        "ItemDescription": l.get("ItemDescription"),
                        "WarehouseCode": l.get("WarehouseCode"),
                        "Quantity": l.get("Quantity"),
                    }
                    for l in p.get("DocumentLines", [])
                ],
            }
            for p in data["value"]
        ]

        #Relaciones desde FACTURAS
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                RTRIM(LTRIM(NUMERO_PEDIDO)) AS NUM_PEDIDO,
                RTRIM(LTRIM(NUMERO_SOLICITUD_SAP)) AS NUM_SOLICITUD
            FROM FACTURAS
            WHERE NUMERO_PEDIDO IS NOT NULL
              AND NUMERO_SOLICITUD_SAP IS NOT NULL
              AND LEN(RTRIM(LTRIM(NUMERO_PEDIDO))) > 0
        """)
        registros = cur.fetchall()
        conn.close()
        relaciones = {}
        for pedido_db, solicitud_db in registros:
            if not pedido_db or not solicitud_db:
                continue
            # Normaliza los datos
            pedido_norm = str(pedido_db).strip().lstrip("0")
            solicitud_norm = str(solicitud_db).strip()
            # Se guarda la relación
            relaciones[pedido_norm] = solicitud_norm
        print(f"🧩 [DEBUG] Relaciones construidas: {relaciones}")


        #VINCULAR SOLICITUDES A PEDIDOS
        for pedido_sap in pedidos:
            docnum_str = str(pedido_sap.get("DocNum")).strip().lstrip("0")
            solicitud_encontrada = relaciones.get(docnum_str) 
            pedido_sap["SolicitudSAP"] = solicitud_encontrada if solicitud_encontrada else None

        print("✅ [DEBUG] Pedidos cruzados correctamente con FACTURAS")
        return jsonify({"status": "ok", "data": pedidos}), 200

    except Exception as e:
        print(f"❌ Error en /sap/pedidos_abiertos: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    

    
@sap_getters_bp.route("/sap/obtener_datos_ocr", methods=["GET"])
def obtener_datos_ocr():
    """
    Obtiene cantidad (litros) y precio unitario (PBASE_SI_U)
    desde la BD local a partir del número de pedido SAP (NUMERO_PEDIDO).
    """
    try:
        pedido = request.args.get("pedido")

        if not pedido:
            return jsonify({
                "status": "error",
                "mensaje": "Falta parámetro ?pedido="
            }), 400

        conn = get_connection()
        cursor = conn.cursor()

        # === Buscar factura vinculada al número de pedido ===
        cursor.execute("""
            SELECT TOP 1 ID_FACTURA, NUMERO_PEDIDO, NUMERO_SOLICITUD_SAP, FECHA_EMISION
            FROM FACTURAS
            WHERE NUMERO_PEDIDO = ?
        """, (str(pedido),))
        factura_row = cursor.fetchone()

        if not factura_row:
            cursor.close()
            conn.close()
            return jsonify({
                "status": "error",
                "mensaje": f"No se encontró ninguna factura asociada al pedido {pedido}."
            }), 404

        id_factura = factura_row[0]
        solicitud_sap = factura_row[2]
        fecha_emision = factura_row[3]

        # === Obtener detalle del producto ===
        cursor.execute("""
            SELECT TOP 1 
                D.CANTIDAD,
                D.PBASE_SI_U,
                P.NOMBRE_PRODUCTO
            FROM DETALLE_PRODUCTO AS D
            INNER JOIN PRODUCTO AS P ON P.ID_PRODUCTO = D.ID_PRODUCTO
            WHERE D.ID_FACTURA = ?
        """, (id_factura,))
        detalle = cursor.fetchone()

        cursor.close()
        conn.close()

        if not detalle:
            return jsonify({
                "status": "error",
                "mensaje": f"No se encontró detalle de producto para la factura vinculada al pedido {pedido}."
            }), 404

        cantidad = round(float(detalle[0] or 0), 2)
        precio_unitario = round(float(detalle[1] or 0), 2)
        producto = detalle[2]

        print(f"✅ Datos desde BD: pedido={pedido}, cantidad={cantidad}, precio={precio_unitario}, producto={producto}")

        return jsonify({
            "status": "ok",
            "data": {
                "pedido": pedido,
                "solicitud": solicitud_sap,
                "producto": producto,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "fecha_emision": str(fecha_emision)
            }
        }), 200

    except Exception as e:
        print(f"❌ Error en obtener_datos_ocr: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    





