import datetime
import os
import json
from flask import Blueprint, request, jsonify, current_app
from controllers_sap.sap_service import SAPServiceLayer
from bd import get_connection  

sap_actions_bp = Blueprint("sap_actions_bp", __name__)
@sap_actions_bp.route("/sap/actualizar_pedido", methods=["POST"])
def actualizar_pedido():
    sap = None
    conn = None
    try:
        data = request.get_json()
        doc_entry = data.get("DocEntry")
        item_code = data.get("ItemCode")
        precio_ui = float(data.get("Price") or 0)
        cantidad_ui = float(data.get("Quantity") or 0)

        if not doc_entry:
            return jsonify({"status": "error", "mensaje": "Falta el número de pedido (DocEntry)."}), 400

        print(f"📦 Actualizando pedido DocEntry={doc_entry}, Item={item_code}, Cant={cantidad_ui}, Precio={precio_ui}")

        # === Obtener DocNum y datos desde SAP ===
        sap = SAPServiceLayer()
        sap.login()
        ok, pedido_data = sap.get(f"PurchaseOrders({int(doc_entry)})")

        if not ok or not pedido_data:
            sap.logout()
            return jsonify({"status": "error", "mensaje": f"No se encontró el pedido {doc_entry} en SAP."}), 404

        doc_num = pedido_data.get("DocNum")
        lineas = pedido_data.get("DocumentLines", [])
        if not lineas:
            sap.logout()
            return jsonify({"status": "error", "mensaje": "El pedido no tiene líneas para actualizar."}), 400

        # === Buscar factura asociada en BD (NUMERO_PEDIDO = DocNum) ===
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TOP 1 ID_FACTURA FROM FACTURAS WHERE NUMERO_PEDIDO = ?
        """, (str(doc_num),))
        row = cursor.fetchone()
        conn.close()

        if not row:
            sap.logout()
            return jsonify({"status": "error", "mensaje": f"No se encontró factura con NUMERO_PEDIDO={doc_num}."}), 404

        print(f" Factura asociada encontrada para pedido {doc_num}")

        # === Actualizar solo la línea coincidente (ItemCode) ===
        for l in lineas:
            if l.get("ItemCode") == item_code:
                l["Quantity"] = cantidad_ui
                l["UnitPrice"] = precio_ui

        payload_update = {
            "DocumentLines": [
                {
                    "LineNum": l.get("LineNum"),
                    "ItemCode": l.get("ItemCode"),
                    "Quantity": l.get("Quantity"),
                    "WarehouseCode": l.get("WarehouseCode"),
                    "TaxCode": l.get("TaxCode", "FUEL"),
                    "UnitPrice": l.get("UnitPrice"),
                }
                for l in lineas
            ]
        }

        print("📤 PATCH enviado a SAP:")
        print(json.dumps(payload_update, indent=2, ensure_ascii=False))

        ok_patch, response = sap.patch(f"PurchaseOrders({int(doc_entry)})", payload_update)
        sap.logout()

        if not ok_patch:
            mensaje = (
                response.get("error", {}).get("message", {}).get("value")
                if isinstance(response, dict)
                else str(response)
            )
            print(f"❌ Error SAP al actualizar: {mensaje}")
            return jsonify({"status": "error", "mensaje": mensaje, "detalle": response}), 400

        print(f"✅ Pedido actualizado correctamente en SAP (DocEntry={doc_entry}, DocNum={doc_num})")
        return jsonify({
            "status": "ok",
            "mensaje": f"Pedido {doc_num} actualizado correctamente.",
            "DocEntry": doc_entry,
            "DocNum": doc_num,
            "Cantidad": cantidad_ui,
            "PrecioUnitario": precio_ui,
        }), 200

    except Exception as e:
        if conn:
            conn.close()
        if sap:
            try:
                sap.logout()
            except:
                pass
        print(f"❌ Error general en actualizar_pedido: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500


# ==========================================================
# 🔹 CONVERTIR PEDIDO A BORRADOR DE ENTRADA
# ==========================================================
@sap_actions_bp.route("/sap/convertir_a_borrador_entrada", methods=["POST"])
def convertir_a_borrador_entrada():
    """
    Convierte un Pedido de Compra en un BORRADOR de Entrada de Mercancía (Draft),
    sin generar DocNum, para permitir edición posterior (costing codes, impuestos, etc.)
    """
    try:
        data = request.get_json()
        doc_entry = data.get("DocEntry")

        if not doc_entry:
            return jsonify({
                "status": "error",
                "mensaje": "Falta el número de pedido (DocEntry)."
            }), 400

        sap = SAPServiceLayer()
        sap.login()

        ok, pedido = sap.get(f"PurchaseOrders({int(doc_entry)})")
        if not ok or not pedido:
            sap.logout()
            return jsonify({
                "status": "error",
                "mensaje": f"No se encontró el pedido {doc_entry} en SAP."
            }), 404

        payload_draft = {
            "DocObjectCode": "oPurchaseDeliveryNotes", 
            "DocDate": pedido.get("DocDate"),
            "DocDueDate": pedido.get("DocDueDate"),
            "CardCode": pedido.get("CardCode"),
            "Comments": f"Borrador creado automáticamente desde Pedido {pedido.get('DocNum')}",
            "DocumentLines": [
                {
                    "BaseType": 22,
                    "BaseEntry": pedido.get("DocEntry"),
                    "BaseLine": l.get("LineNum"),
                    "Quantity": l.get("Quantity"),
                    "WarehouseCode": l.get("WarehouseCode"),
                    "ItemCode": l.get("ItemCode"),
                    "ItemDescription": l.get("ItemDescription"),
                }
                for l in pedido.get("DocumentLines", [])
            ],
        }

        ok, draft = sap.post("Drafts", payload_draft)
        sap.logout()

        if not ok:
            print("❌ Error al crear borrador:", draft)
            return jsonify({
                "status": "error",
                "mensaje": "Error al crear el borrador en SAP",
                "detalle": draft
            }), 500

        draft_entry = draft.get("DocEntry")
        print(f"📝 Borrador de Entrada creado (DraftEntry={draft_entry})")

        return jsonify({
            "status": "ok",
            "mensaje": f"Borrador creado correctamente (DraftEntry={draft_entry}).",
            "data": {
                "DraftEntry": draft_entry,
                "DocEntryPedido": doc_entry,
                "CardCode": pedido.get("CardCode"),
                "CardName": pedido.get("CardName"),
            }
        }), 200

    except Exception as e:
        print(f"❌ Error convertir_a_borrador_entrada: {e}")
        return jsonify({
            "status": "error",
            "mensaje": str(e)
        }), 500


# ==========================================================
# 🔹 CONFIRMAR BORRADOR CON OCR + IMPUESTOS
# ==========================================================
@sap_actions_bp.route("/sap/confirmar_borrador_con_ocr", methods=["POST"])
def confirmar_borrador_con_ocr():
    """
    Convierte un borrador en documento real de Entrada de Mercancía
    con impuestos FUEL + IVA obtenidos desde la BD local.
    """
    try:
        data = request.get_json()
        draft_entry = data.get("DraftEntry")

        if not draft_entry:
            return jsonify({"status": "error", "mensaje": "Falta el DraftEntry del borrador."}), 400

        sap = SAPServiceLayer()
        sap.login()
        ok, draft = sap.get(f"Drafts({int(draft_entry)})")

        if not ok or not draft:
            sap.logout()
            return jsonify({"status": "error", "mensaje": f"No se encontró el borrador {draft_entry}."}), 404

        # Obtener base + impuestos desde BD
        base_entry = draft.get("DocumentLines", [{}])[0].get("BaseEntry")
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TOP 1 BASE_AFECTA, IEF, IVA
            FROM FACTURAS
            WHERE NUMERO_PEDIDO = ?
        """, (base_entry,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            sap.logout()
            return jsonify({"status": "error", "mensaje": f"No hay datos de impuestos para pedido {base_entry}."}), 404

        base_afecta, ief, iva = float(row[0] or 0), float(row[1] or 0), float(row[2] or 0)

        line_taxes = [
            {
                "JurisdictionCode": "FUEL",
                "JurisdictionType": 2,
                "TaxAmount": ief,
                "TaxAmountSC": ief,
                "TaxAmountFC": ief,
                "TaxRate": 1.0,
                "BaseSum": base_afecta
            }
        ]

        payload = {
            "DocDate": draft.get("DocDate"),
            "DocDueDate": draft.get("DocDueDate"),
            "CardCode": draft.get("CardCode"),
            "Comments": f"Entrada generada desde borrador {draft_entry}",
            "DocumentLines": [
                {
                    "BaseType": 22,
                    "BaseEntry": l.get("BaseEntry"),
                    "BaseLine": l.get("BaseLine"),
                    "Quantity": l.get("Quantity"),
                    "WarehouseCode": l.get("WarehouseCode"),
                    "TaxCode": "FUEL",
                    "LineTaxJurisdictions": line_taxes
                }
                for l in draft.get("DocumentLines", [])
            ]
        }

        print("🚛 Enviando entrada de mercancía definitiva a SAP:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))

        ok, entrada = sap.post("PurchaseDeliveryNotes", payload)
        sap.logout()

        if not ok:
            print("❌ Error al crear entrada:", entrada)
            return jsonify({"status": "error", "mensaje": "Error creando entrada", "detalle": entrada}), 400

        print(f"✅ Entrada final creada (DocNum={entrada.get('DocNum')})")
        return jsonify({
            "status": "ok",
            "mensaje": f"Entrada creada correctamente (DocNum={entrada.get('DocNum')}).",
            "entrada": entrada
        }), 200

    except Exception as e:
        print(f"❌ Error en confirmar_borrador_con_ocr: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500



@sap_actions_bp.route("/sap/convertir_a_entrada_directa", methods=["POST"])
def convertir_a_entrada_directa():
    """
    Crea una entrada de mercancía desde un pedido de compra,
    aplicando automáticamente el impuesto FUEL (usando valores desde FACTURAS)
    y registrando el número de entrada en la BD local.
    """
    try:
        data = request.get_json()
        doc_entry = data.get("DocEntry")

        if not doc_entry:
            return jsonify({
                "status": "error",
                "mensaje": "Falta el DocEntry del pedido"
            }), 400

        print(f"📦 Iniciando conversión directa del pedido {doc_entry} → Entrada de mercancía")

        sap = SAPServiceLayer()
        sap.login()

        # === Obtener pedido desde SAP ===
        ok, pedido = sap.get(f"PurchaseOrders({int(doc_entry)})")
        if not ok or not pedido:
            sap.logout()
            return jsonify({
                "status": "error",
                "mensaje": f"No se encontró el pedido {doc_entry} en SAP."
            }), 404

        doc_num = pedido.get("DocNum")
        print(f"✅ Pedido obtenido → DocEntry={doc_entry}, DocNum={doc_num}")

        # === Consultar impuestos desde la BD local ===
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TOP 1 BASE_AFECTA, IEF
            FROM FACTURAS
            WHERE NUMERO_PEDIDO = ?
        """, (str(doc_num),))
        row = cursor.fetchone()
        conn.close()

        base_total = float(row[0]) if row and row[0] else 0
        ief_total = float(row[1]) if row and row[1] else 0
        print(f"Datos BD → Base={base_total}, IEF={ief_total}")

        # === Construir payload SAP ===
        lineas = pedido.get("DocumentLines", [])
        base_linea_total = sum([(l.get("Quantity") or 0) * (l.get("UnitPrice") or 0) for l in lineas]) or 1

        payload = {
            "DocDate": datetime.date.today().strftime("%Y-%m-%d"),
            "DocDueDate": pedido.get("DocDueDate"),
            "CardCode": pedido.get("CardCode"),
            "Comments": f"Entrada automática generada desde Pedido {doc_num}",
            "DocumentLines": []
        }

        for l in lineas:
            cantidad = float(l.get("Quantity") or 0)
            precio = float(l.get("UnitPrice") or 0)
            base_linea = cantidad * precio
            proporcion = base_linea / base_linea_total
            ief_linea = round(ief_total * proporcion, 2)

            payload["DocumentLines"].append({
                "BaseType": 22,  # Pedido de compra
                "BaseEntry": pedido.get("DocEntry"),
                "BaseLine": l.get("LineNum"),
                "ItemCode": l.get("ItemCode"),
                "Quantity": cantidad,
                "WarehouseCode": l.get("WarehouseCode"),
                "UnitPrice": precio,
                "TaxCode": "FUEL",
                "LineTaxJurisdictions": [
                    {
                        "JurisdictionCode": "FUEL",
                        "JurisdictionType": 2,
                        "TaxRate": 1.0,
                        "BaseSum": base_linea,
                        "TaxAmount": ief_linea,
                        "TaxAmountSC": ief_linea,
                        "TaxAmountFC": ief_linea,
                        "TaxOnly": "tNO"
                    }
                ]
            })

        print("📤 Payload final a enviar a SAP:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))

        # === Crear entrada definitiva directamente en SAP ===
        ok_final, entrada = sap.post("PurchaseDeliveryNotes", payload)
        sap.logout()

        if not ok_final:
            print("❌ Error al crear la entrada definitiva:", entrada)
            return jsonify({
                "status": "error",
                "mensaje": "Error al crear entrada definitiva en SAP",
                "detalle": entrada
            }), 400

        entrada_docnum = entrada.get("DocNum")
        print(f"✅ Entrada definitiva creada correctamente (DocNum={entrada_docnum})")

        # === Registrar en BD local ===
        try:
            conn = get_connection()
            cursor = conn.cursor()

            cursor.execute("""
                UPDATE FACTURAS
                SET ENTRADA_MERCANCIA = ?
                WHERE NUMERO_PEDIDO = ?
            """, (str(entrada_docnum), str(doc_num)))

            conn.commit()
            print(f"💾 ENTRADA_MERCANCIA actualizada correctamente → Pedido={doc_num}, Entrada={entrada_docnum}")

        except Exception as e:
            print(f"⚠️ Error al registrar ENTRADA_MERCANCIA en BD local: {e}")
            conn.rollback()
        finally:
            conn.close()

        # Retornar resultado exitoso cuando todo haya finalizado
        return jsonify({
            "status": "ok",
            "mensaje": f"Entrada creada correctamente (DocNum={entrada_docnum})",
            "DocNumEntrada": entrada_docnum
        }), 200

    except Exception as e:
        # Asegurar logout si ocurrió antes de cualquier retorno y retornar error
        try:
            sap.logout()
        except Exception:
            pass
        print(f"❌ Error en convertir_a_entrada_directa: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500
