from flask import Blueprint, jsonify
from controllers_sap.sap_service import SAPServiceLayer
from bd import get_connection

sap_open_docs_bp = Blueprint("sap_open_docs_bp", __name__)

@sap_open_docs_bp.route("/sap/solicitudes_abiertas", methods=["GET"])
def get_solicitudes_abiertas():
    try:
        sap = SAPServiceLayer()
        sap.login()
        query = (
            "PurchaseRequests?"
            "$select=DocNum,DocEntry,DocDate,DocDueDate,DocumentStatus, Requester"
            "&$filter=DocumentStatus eq 'bost_Open'"
            "&$orderby=DocEntry desc"
        )
        ok, data = sap.get(query)
        if not ok:
            return jsonify({"status": "error", "mensaje": "Error al obtener las solicitudes SAP."}), 500

        # Buscar proveedor desde BD local (por si SAP no lo trae)
        from bd import get_connection
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT NUMERO_SOLICITUD_SAP, NOMBRE_EMISOR, RUT_EMISOR 
            FROM FACTURAS WHERE NUMERO_SOLICITUD_SAP IS NOT NULL
        """)
        relaciones = {str(r[0]): {"nombre": r[1], "rut": r[2]} for r in cur.fetchall()}
        conn.close()

        solicitudes = []
        for d in data.get("value", []):
            doc_entry = d.get("DocEntry")
            detalle_ok, detalle_data = sap.get(f"PurchaseRequests({doc_entry})")

            if not detalle_ok or "DocumentLines" not in detalle_data:
                continue

            lineas = detalle_data.get("DocumentLines", [])


            lineas = detalle_data.get("DocumentLines", [])
            lineas_filtradas = [
                {
                    "ItemCode": l.get("ItemCode"),
                    "ItemDescription": l.get("ItemDescription"),
                    "WarehouseCode": l.get("WarehouseCode"),
                    "Quantity": l.get("Quantity"),
                    "LineVendor": l.get("LineVendor"),
                    "LineVendorName": l.get("LineVendorName"),
                    "Requester": l.get("Requester")

                }
                for l in lineas
                if l.get("ItemCode") == "112080001"
            ]
            if not lineas_filtradas:
                continue

            primer_linea = lineas_filtradas[0]
            card_code = primer_linea.get("LineVendor")
            card_name = primer_linea.get("LineVendorName")
            requester = primer_linea.get("Requester")


            if not card_name and str(d.get("DocNum")) in relaciones:
                card_name = relaciones[str(d.get("DocNum"))]["nombre"]
                card_code = relaciones[str(d.get("DocNum"))]["rut"]

            solicitudes.append({
                "tipo": "Solicitud de Compra",
                "DocNum": d.get("DocNum"),
                "DocEntry": d.get("DocEntry"),
                "CardCode": card_code,
                "CardName": card_name,
                "DocDate": d.get("DocDate"),
                "DocDueDate": d.get("DocDueDate"),
                "Requester": d.get("Requester"),
                "Estado": "Abierta",
                "Lineas": lineas_filtradas,


            })

        return jsonify({"status": "ok", "data": solicitudes}), 200

    except Exception as e:
        print("❌ Error en get_solicitudes_abiertas:", e)
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@sap_open_docs_bp.route("/sap/pedidos_abiertos", methods=["GET"])
def get_pedidos_abiertos():
    try:
        sap = SAPServiceLayer()
        sap.login()

        # === cargar relación desde la BD local ===
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT NUMERO_PEDIDO, NUMERO_SOLICITUD_SAP, FECHA_EMISION
            FROM FACTURAS
            WHERE NUMERO_PEDIDO IS NOT NULL AND NUMERO_SOLICITUD_SAP IS NOT NULL
        """)
        relacion_pedido_solicitud = {
            str(r[0]).strip(): {
                "solicitud": str(r[1]).strip(),
                "fecha_emision": str(r[2]) if r[2] else None
            }
            for r in cur.fetchall()
        }
        conn.close()

        # === obtener pedidos abiertos desde SAP ===
        query = (
            "PurchaseOrders?"
            "$select=DocNum,DocEntry,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,DocumentStatus"
            "&$filter=DocumentStatus eq 'bost_Open'"
            "&$orderby=DocEntry desc"
        )
        ok, data = sap.get(query)
        if not ok:
            return jsonify({"status": "error", "mensaje": "Error al obtener pedidos SAP."}), 500

        pedidos = []
        for d in data.get("value", []):
            doc_entry = d.get("DocEntry")
            doc_num = str(d.get("DocNum"))

            # === Obtener líneas del pedido ===
            detalle_ok, detalle_data = sap.get(f"PurchaseOrders({doc_entry})")
            if not detalle_ok or "DocumentLines" not in detalle_data:
                continue

            lineas = detalle_data.get("DocumentLines", [])
            lineas_filtradas = [
                {
                    "ItemCode": l.get("ItemCode"),
                    "ItemDescription": l.get("ItemDescription"),
                    "WarehouseCode": l.get("WarehouseCode"),
                    "Quantity": l.get("Quantity"),
                }
                for l in lineas
                if l.get("ItemCode") == "112080001"
            ]
            if not lineas_filtradas:
                continue

            # === obtener número de solicitud y fecha de emisión desde la BD ===
            info_rel = relacion_pedido_solicitud.get(doc_num, None)
            num_solicitud = info_rel["solicitud"] if info_rel else None
            fecha_emision = info_rel["fecha_emision"] if info_rel else None

            pedidos.append({
                "tipo": "Pedido",
                "DocNum": d.get("DocNum"),
                "DocEntry": d.get("DocEntry"),
                "CardCode": d.get("CardCode"),
                "CardName": d.get("CardName"),
                "DocDate": d.get("DocDate"),
                "DocDueDate": d.get("DocDueDate"),
                "Moneda": d.get("DocCurrency"),
                "Total": d.get("DocTotal"),
                "Estado": "Abierto",
                "NUMERO_SOLICITUD_SAP": num_solicitud,
                "FECHA_EMISION": fecha_emision,
                "Lineas": lineas_filtradas,
            })

        return jsonify({"status": "ok", "data": pedidos}), 200

    except Exception as e:
        print("❌ Error en get_pedidos_abiertos:", e)
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    

@sap_open_docs_bp.route("/sap/entradas_abiertas", methods=["GET"])
def get_entradas_abiertas():
    try:
        sap = SAPServiceLayer()
        sap.login()

        # === Cargar relación desde BD local ===
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                ENTRADA_MERCANCIA, 
                NUMERO_PEDIDO, 
                NUMERO_SOLICITUD_SAP, 
                NUMERO_FACTURA,
                FECHA_EMISION
            FROM FACTURAS
            WHERE ENTRADA_MERCANCIA IS NOT NULL
        """)

        # Mapear por ENTRADA_MERCANCIA
        relacion_entrada = {
            str(r[0]).strip(): {
                "pedido": str(r[1]).strip() if r[1] else None,
                "solicitud": str(r[2]).strip() if r[2] else None,
                "factura": str(r[3]).strip() if r[3] else None,
                "fecha_emision": str(r[4]).strip() if r[4] else None  
            }
            for r in cur.fetchall()
        }
        conn.close()

        # === Obtener entradas abiertas desde SAP ===
        query = (
            "PurchaseDeliveryNotes?"
            "$select=DocNum,DocEntry,CardCode,CardName,DocDate,DocDueDate,DocTotal,"
            "DocCurrency,DocumentStatus,Comments"
            "&$filter=DocumentStatus eq 'bost_Open'"
            "&$orderby=DocEntry desc"
        )

        ok, data = sap.get(query)
        if not ok or "value" not in data:
            return jsonify({
                "status": "error",
                "mensaje": "Error al obtener entradas desde SAP."
            }), 500

        entradas = []
        for d in data["value"]:
            doc_num = str(d.get("DocNum")).strip()
            doc_entry = d.get("DocEntry")

            # === Obtener relación desde la BD local ===
            info_rel = relacion_entrada.get(doc_num, None)
            num_pedido = info_rel["pedido"] if info_rel else None
            num_solicitud = info_rel["solicitud"] if info_rel else None
            num_factura = info_rel["factura"] if info_rel else None
            fecha_emision = info_rel["fecha_emision"] if info_rel else None  

            # === Obtener líneas del documento SAP ===
            detalle_ok, detalle_data = sap.get(f"PurchaseDeliveryNotes({doc_entry})")
            if not detalle_ok or "DocumentLines" not in detalle_data:
                continue

            lineas = detalle_data.get("DocumentLines", [])
            lineas_filtradas = [
                {
                    "ItemCode": l.get("ItemCode"),
                    "ItemDescription": l.get("ItemDescription"),
                    "WarehouseCode": l.get("WarehouseCode"),
                    "Quantity": l.get("Quantity"),
                }
                for l in lineas
                if l.get("ItemCode") == "112080001"
            ]
            if not lineas_filtradas:
                continue

            entradas.append({
                "tipo": "Entrada de Mercancía",
                "DocNum": d.get("DocNum"),
                "DocEntry": d.get("DocEntry"),
                "CardCode": d.get("CardCode", "—"),
                "CardName": d.get("CardName", "—"),
                "DocDate": d.get("DocDate"),
                "DocDueDate": d.get("DocDueDate"),
                "Total": d.get("DocTotal", 0),
                "Moneda": d.get("DocCurrency", "CLP"),
                "Comentarios": d.get("Comments", ""),
                "NUMERO_PEDIDO": num_pedido or "—",
                "NUMERO_SOLICITUD_SAP": num_solicitud or "—",
                "NUMERO_FACTURA": num_factura or "—",
                "FECHA_EMISION": fecha_emision or "—",
                "Lineas": lineas_filtradas
            })

        sap.logout()
        return jsonify({"status": "ok", "data": entradas}), 200

    except Exception as e:
        print("❌ Error en get_entradas_abiertas:", e)
        return jsonify({"status": "error", "mensaje": str(e)}), 500