import os
import pandas as pd
from flask import Blueprint, jsonify, current_app, send_file, send_from_directory, request
from controllers.validations import formato_peso_chileno, registrar_log
import io
import pandas as pd
from flask import Blueprint, jsonify, send_file
import datetime
from bd import get_connection

data_bp = Blueprint("data_bp", __name__)

@data_bp.route("/export_facturas", methods=["GET"])
def export_facturas():
    try:
        conn = get_connection()

        query = """
            SELECT 
                f.ID_FACTURA,
                f.NUMERO_FACTURA,
                f.NUMERO_SOLICITUD_SAP,
                f.FECHA_EMISION,
                f.RUT_EMISOR,
                f.NOMBRE_EMISOR,
                f.RUT_RECEPTOR,
                f.NOMBRE_RECEPTOR,
                f.DIRECCION_RECEPTOR,
                f.DESPACHO_RECEPTOR,
                f.BASE_AFECTA,
                f.FEEP,
                f.IEV,
                f.IEF,
                f.IVA,
                f.TOTAL,
                f.NUMERO_PEDIDO,
                f.ENTRADA_MERCANCIA,
                f.USUARIO_INGRESO,
                f.FECHA_INGRESO,
                f.HORA_INGRESO,
                p.NOMBRE_PRODUCTO AS PRODUCTO,
                dp.CANTIDAD,
                dp.PBASE_SI_U AS PRECIO_UNITARIO,
                dp.IEV_U AS IEV_UNITARIO,
                dp.IEF_U AS IEF_UNITARIO,
                dp.SUBTOTAL,
                e.NOMBRE_ESTANQUE,
                e.UBICACION AS UBICACION_ESTANQUE,
                e.CAPACIDAD_LITROS,
                d.LITROS_ASIGNADOS
            FROM FACTURAS f
            LEFT JOIN DETALLE_PRODUCTO dp ON f.ID_FACTURA = dp.ID_FACTURA
            LEFT JOIN PRODUCTO p ON dp.ID_PRODUCTO = p.ID_PRODUCTO
            LEFT JOIN DISTRIBUCIONES d ON f.ID_FACTURA = d.ID_FACTURA
            LEFT JOIN ESTANQUES e ON d.ID_ESTANQUE = e.ID_ESTANQUE
            ORDER BY f.FECHA_EMISION DESC
        """

        df = pd.read_sql(query, conn)
        conn.close()

        # === Crear el Excel en memoria ===
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Facturas")

        output.seek(0)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"facturas_export_{timestamp}.xlsx"

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )


    except Exception as e:
        return jsonify({"error": str(e)}), 500




#Estanques
@data_bp.route("/estanques", methods=["GET"])
def get_estanques():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT ID_ESTANQUE, NOMBRE_ESTANQUE FROM ESTANQUES")
        res = [{"id": r[0], "nombre": r[1]} for r in cur.fetchall()]
        conn.close()
        return jsonify(res)
    except Exception as e:
        registrar_log(None, "RECHAZADO", f"Error al obtener estanques: {str(e)}")
        return jsonify({"error": str(e)}), 500

#Logs
@data_bp.route("/logs", methods=["GET"])
def get_logs():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TOP 100 ID_LOGS, ID_FACTURA, FECHA, HORA, ESTADO, COMENTARIO
            FROM LOGS
            ORDER BY ID_LOGS DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        logs = [{
            "ID_LOGS": r[0],
            "ID_FACTURA": r[1],
            "FECHA": str(r[2]),
            "HORA": str(r[3]),
            "ESTADO": r[4],
            "COMENTARIO": r[5]
        } for r in rows]
        return jsonify(logs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#Descargar PDF subido
@data_bp.route('/uploads/<path:filename>')
def download_file(filename):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)

# Facturas
@data_bp.route("/facturas", methods=["GET"])
def get_facturas():
    """
    Devuelve el listado de facturas registradas en la BD local,
    con información de estanques y ubicación asociada.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT TOP 100
                F.ID_FACTURA,
                F.NUMERO_FACTURA,
                F.NUMERO_SOLICITUD_SAP,
                F.FECHA_EMISION,
                F.NOMBRE_EMISOR,
                F.NOMBRE_RECEPTOR,
                F.TOTAL,
                F.FECHA_INGRESO,
                F.NUMERO_PEDIDO,
                F.ENTRADA_MERCANCIA
            FROM FACTURAS F
            ORDER BY F.ID_FACTURA DESC
        """)
        rows = cur.fetchall()

        facturas = []
        for row in rows:
            id_factura     = row[0]
            numero_factura = row[1]
            solicitud      = str(row[2]) if row[2] else None
            fecha_emision  = row[3]
            nombre_emisor  = row[4]
            nombre_receptor= row[5]
            total          = row[6]
            fecha_ingreso  = row[7]
            numero_pedido  = row[8]
            entrada_merc   = row[9]

            # === Obtener estanques y ubicaciones ===
            est, ubic = "—", "—"
            try:
                cur2 = conn.cursor()
                cur2.execute("""
                    SELECT E.NOMBRE_ESTANQUE, E.UBICACION
                    FROM DISTRIBUCIONES D
                    INNER JOIN ESTANQUES E ON E.ID_ESTANQUE = D.ID_ESTANQUE
                    WHERE D.ID_FACTURA = ?
                """, (id_factura,))
                res = cur2.fetchall()
                if res:
                    est_list = sorted({r[0] for r in res if r[0]})
                    ubic_list = sorted({r[1] for r in res if r[1]})
                    est = ", ".join(est_list) if est_list else "—"
                    ubic = ", ".join(ubic_list) if ubic_list else "—"
            except Exception as e:
                print(f"⚠️ Error al obtener estanques: {e}")

            # === Buscar PDF asociado ===
            pdf_filename = None
            if solicitud:
                try:
                    upload_dir = current_app.config.get("UPLOAD_FOLDER", "")
                    for fname in os.listdir(upload_dir):
                        if fname.startswith(f"Solicitud_{solicitud}_") and fname.lower().endswith(".pdf"):
                            pdf_filename = fname
                            break
                except Exception as e:
                    print(f"⚠️ Error buscando PDF: {e}")

            # === Construir respuesta ===
            facturas.append({
                "ID_FACTURA": id_factura,
                "NUMERO_FACTURA": numero_factura,
                "NUMERO_SOLICITUD_SAP": solicitud,
                "FECHA_EMISION": str(fecha_emision) if fecha_emision else "",
                "NOMBRE_EMISOR": nombre_emisor,
                "NOMBRE_RECEPTOR": nombre_receptor,
                "TOTAL": float(total or 0),
                "FECHA_INGRESO": str(fecha_ingreso) if fecha_ingreso else "",
                "NUMERO_PEDIDO": numero_pedido or "",
                "ENTRADA_MERCANCIA": entrada_merc or "",
                "PDF_FILENAME": pdf_filename,
                "ESTANQUE": est,
                "UBICACION": ubic
            })

        conn.close()
        return jsonify(facturas), 200

    except Exception as e:
        print(f"❌ Error en /facturas: {e}")
        return jsonify({"error": str(e)}), 500



@data_bp.route("/existe_solicitud", methods=["GET"])
def existe_solicitud():
    """
    Verifica si una solicitud SAP ya existe en la base de datos local.
    """
    try:
        num_solicitud = request.args.get("num_solicitud")  #
        if not num_solicitud:
            return jsonify({"existe": False}), 400

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM FACTURAS WHERE NUMERO_SOLICITUD_SAP = ?", (num_solicitud,))
        existe = cursor.fetchone()[0] > 0
        conn.close()

        print(f"🔍 Verificación duplicado — Solicitud {num_solicitud}: {'EXISTE' if existe else 'NO EXISTE'}")
        return jsonify({"existe": existe}), 200

    except Exception as e:
        print(f"⚠️ Error verificando solicitud: {e}")
        registrar_log(None, "ERROR_VERIFICACION_SOLICITUD", str(e))
        return jsonify({"existe": False}), 500


@data_bp.route("/sap/detalle_factura", methods=["GET"])
def get_detalle_factura():
    """
    Retorna los detalles del producto asociados a una factura según el número de pedido (NUMERO_PEDIDO).
    Incluye: cantidad, precios unitarios, subtotales e impuestos.
    """
    try:
        pedido = request.args.get("pedido")
        if not pedido:
            return jsonify({"status": "error", "mensaje": "Falta parámetro ?pedido="}), 400

        conn = get_connection()
        cursor = conn.cursor()

        # === Buscar factura vinculada al pedido ===
        cursor.execute("""
            SELECT TOP 1 ID_FACTURA, NUMERO_PEDIDO, NUMERO_FACTURA, FECHA_EMISION,
                   NOMBRE_EMISOR, NOMBRE_RECEPTOR, TOTAL
            FROM FACTURAS
            WHERE NUMERO_PEDIDO = ?
        """, (str(pedido),))
        factura_row = cursor.fetchone()

        if not factura_row:
            cursor.close()
            conn.close()
            return jsonify({"status": "error", "mensaje": f"No se encontró factura vinculada al pedido {pedido}."}), 404

        id_factura = factura_row[0]
        numero_factura = factura_row[2]
        fecha_emision = factura_row[3]
        nombre_emisor = factura_row[4]
        nombre_receptor = factura_row[5]
        total_factura = factura_row[6]

        # === Buscar detalle de productos ===
        cursor.execute("""
            SELECT 
                P.NOMBRE_PRODUCTO,
                D.CANTIDAD,
                D.PBASE_SI_U,
                D.IEF_U,
                D.IEV_U,
                D.PTOTAL_U,
                D.SUBTOTAL
            FROM DETALLE_PRODUCTO AS D
            INNER JOIN PRODUCTO AS P ON P.ID_PRODUCTO = D.ID_PRODUCTO
            WHERE D.ID_FACTURA = ?
        """, (id_factura,))
        detalles = cursor.fetchall()

        cursor.close()
        conn.close()

        detalle_list = [
            {
                "producto": r[0],
                "cantidad": float(r[1] or 0),
                "precio_unitario": float(r[2] or 0),
                "impuesto_especifico_fijo": float(r[3] or 0),
                "impuesto_especifico_variable": float(r[4] or 0),
                "precio_total": float(r[5] or 0),
                "subtotal": float(r[6] or 0)
            }
            for r in detalles
        ]

        return jsonify({
            "status": "ok",
            "factura": {
                "pedido": pedido,
                "numero_factura": numero_factura,
                "fecha_emision": str(fecha_emision),
                "nombre_emisor": nombre_emisor,
                "nombre_receptor": nombre_receptor,
                "total": float(total_factura or 0)
            },
            "detalles": detalle_list
        }), 200

    except Exception as e:
        print(f"❌ Error en /sap/detalle_factura: {e}")
        return jsonify({"status": "error", "mensaje": str(e)}), 500

# ==========================================================
#  Estanques por bodega
# ==========================================================
@data_bp.route("/estanques_por_bodega", methods=["GET"])
def get_estanques_por_bodega():
    try:
        bodega = request.args.get("bodega", "").strip().upper()
        if not bodega:
            return jsonify({"error": "Debe especificar el parámetro ?bodega="}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT ID_ESTANQUE, NOMBRE_ESTANQUE, UBICACION, CAPACIDAD_LITROS
            FROM ESTANQUES
            WHERE UPPER(UBICACION) = ?
        """, (bodega,))
        rows = cur.fetchall()
        conn.close()

        estanques = [
            {
                "id": r[0],
                "nombre": r[1],
                "ubicacion": r[2],
                "capacidad": r[3]
            }
            for r in rows
        ]

        if not estanques:
            return jsonify({"bodega": bodega, "estanques": [], "mensaje": "No se encontraron estanques"}), 200

        return jsonify({"bodega": bodega, "estanques": estanques}), 200

    except Exception as e:
        registrar_log(None, "ERROR_GET_ESTANQUES_BODEGA", str(e))
        return jsonify({"error": str(e)}), 500



# ==========================================================
# 🔹 SEGUIMIENTO POR PEDIDO
# ==========================================================
@data_bp.route("/seguimiento_estanques", methods=["GET"])
def seguimiento_estanques():
    try:
        numero_pedido = request.args.get("numero_pedido")
        if not numero_pedido:
            return jsonify({"error": "Falta numero_pedido"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # === FACTURA ASOCIADA AL PEDIDO ===
        cur.execute("""
            SELECT 
                f.ID_FACTURA,
                f.NUMERO_FACTURA,
                f.NUMERO_SOLICITUD_SAP,
                f.NOMBRE_EMISOR,
                f.NOMBRE_RECEPTOR,
                f.RUT_EMISOR,
                f.RUT_RECEPTOR,
                f.FECHA_EMISION,
                f.BASE_AFECTA,
                f.FEEP,
                f.IEV,
                f.IEF,
                f.IVA,
                f.TOTAL,
                f.NUMERO_PEDIDO,
                f.ENTRADA_MERCANCIA,
                f.USUARIO_INGRESO,
                f.FECHA_INGRESO,
                f.HORA_INGRESO
            FROM FACTURAS f
            WHERE TRY_CAST(RTRIM(LTRIM(f.NUMERO_PEDIDO)) AS INT) = TRY_CAST(? AS INT)
               OR RTRIM(LTRIM(f.NUMERO_PEDIDO)) = ?
        """, (numero_pedido, numero_pedido))

        factura = cur.fetchone()
        if not factura:
            conn.close()
            return jsonify({"error": "No se encontró factura para este pedido"}), 404

        factura_data = {
            "ID_FACTURA": factura[0],
            "NUMERO_FACTURA": factura[1],
            "NUMERO_SOLICITUD_SAP": factura[2],
            "NOMBRE_EMISOR": factura[3],
            "NOMBRE_RECEPTOR": factura[4],
            "RUT_EMISOR": factura[5],
            "RUT_RECEPTOR": factura[6],
            "FECHA_EMISION": str(factura[7]) if factura[7] else None,
            "BASE_AFECTA": float(factura[8] or 0),
            "FEEP": float(factura[9] or 0),
            "IEV": float(factura[10] or 0),
            "IEF": float(factura[11] or 0),
            "IVA": float(factura[12] or 0),
            "TOTAL": float(factura[13] or 0),
            "NUMERO_PEDIDO": factura[14],
            "ENTRADA_MERCANCIA": factura[15],
            "USUARIO_INGRESO": factura[16],
            "FECHA_INGRESO": str(factura[17]) if factura[17] else None,
            "HORA_INGRESO": str(factura[18]) if factura[18] else None
        }

        # === DISTRIBUCIONES RELACIONADAS ===
        cur.execute("""
            SELECT 
                e.NOMBRE_ESTANQUE AS ESTANQUE,
                e.UBICACION,
                e.CAPACIDAD_LITROS,
                d.LITROS_ASIGNADOS,
                dp.PBASE_SI_U,
                dp.IEV_U,
                dp.IEF_U,
                dp.PTOTAL_U,
                dp.SUBTOTAL,
                p.NOMBRE_PRODUCTO AS PRODUCTO
            FROM DISTRIBUCIONES d
            INNER JOIN ESTANQUES e ON d.ID_ESTANQUE = e.ID_ESTANQUE
            LEFT JOIN DETALLE_PRODUCTO dp ON dp.ID_FACTURA = d.ID_FACTURA
            LEFT JOIN PRODUCTO p ON dp.ID_PRODUCTO = p.ID_PRODUCTO
            WHERE d.ID_FACTURA = ?
        """, (factura[0],))

        distribuciones = []
        total_distribuido = 0

        for row in cur.fetchall():
            litros = float(row[3] or 0)
            total_distribuido += litros
            distribuciones.append({
                "ESTANQUE": row[0],
                "UBICACION": row[1],
                "CAPACIDAD_LITROS": float(row[2] or 0),
                "LITROS_ASIGNADOS": litros,
                "PBASE_SI_U": float(row[4] or 0),
                "IEV_U": float(row[5] or 0),
                "IEF_U": float(row[6] or 0),
                "PTOTAL_U": float(row[7] or 0),
                "SUBTOTAL": float(row[8] or 0),
                "PRODUCTO": row[9],
                "NUMERO_SOLICITUD_SAP": factura_data["NUMERO_SOLICITUD_SAP"]
            })

        conn.close()

        return jsonify({
            "factura": factura_data,
            "distribuciones": distribuciones,
            "total_distribuido": total_distribuido
        }), 200

    except Exception as e:
        print("❌ Error en seguimiento_estanques:", e)
        return jsonify({"error": str(e)}), 500


# ==========================================================
# 🔹 SEGUIMIENTO POR SOLICITUD
# ==========================================================
@data_bp.route("/seguimiento_solicitudes", methods=["GET"])
def seguimiento_solicitudes():
    try:
        numero_solicitud = request.args.get("numero_solicitud")
        if not numero_solicitud:
            return jsonify({"error": "Falta numero_solicitud"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # === FACTURA ASOCIADA A LA SOLICITUD ===
        cur.execute("""
            SELECT 
                f.ID_FACTURA,
                f.NUMERO_FACTURA,
                f.NUMERO_SOLICITUD_SAP,
                f.NOMBRE_EMISOR,
                f.NOMBRE_RECEPTOR,
                f.RUT_EMISOR,
                f.RUT_RECEPTOR,
                f.FECHA_EMISION,
                f.BASE_AFECTA,
                f.FEEP,
                f.IEV,
                f.IEF,
                f.IVA,
                f.TOTAL,
                f.NUMERO_PEDIDO,
                f.ENTRADA_MERCANCIA,
                f.USUARIO_INGRESO,
                f.FECHA_INGRESO,
                f.HORA_INGRESO
            FROM FACTURAS f
            WHERE TRY_CAST(RTRIM(LTRIM(f.NUMERO_SOLICITUD_SAP)) AS INT) = TRY_CAST(? AS INT)
               OR RTRIM(LTRIM(f.NUMERO_SOLICITUD_SAP)) = ?
        """, (numero_solicitud, numero_solicitud))

        factura = cur.fetchone()
        if not factura:
            conn.close()
            return jsonify({"error": "No se encontró factura para esta solicitud"}), 404

        factura_data = {
            "ID_FACTURA": factura[0],
            "NUMERO_FACTURA": factura[1],
            "NUMERO_SOLICITUD_SAP": factura[2],
            "NOMBRE_EMISOR": factura[3],
            "NOMBRE_RECEPTOR": factura[4],
            "RUT_EMISOR": factura[5],
            "RUT_RECEPTOR": factura[6],
            "FECHA_EMISION": str(factura[7]) if factura[7] else None,
            "BASE_AFECTA": float(factura[8] or 0),
            "FEEP": float(factura[9] or 0),
            "IEV": float(factura[10] or 0),
            "IEF": float(factura[11] or 0),
            "IVA": float(factura[12] or 0),
            "TOTAL": float(factura[13] or 0),
            "NUMERO_PEDIDO": factura[14],
            "ENTRADA_MERCANCIA": factura[15],
            "USUARIO_INGRESO": factura[16],
            "FECHA_INGRESO": str(factura[17]) if factura[17] else None,
            "HORA_INGRESO": str(factura[18]) if factura[18] else None
        }

        # === DISTRIBUCIONES RELACIONADAS ===
        cur.execute("""
            SELECT 
                e.NOMBRE_ESTANQUE AS ESTANQUE,
                e.UBICACION,
                e.CAPACIDAD_LITROS,
                d.LITROS_ASIGNADOS,
                dp.PBASE_SI_U,
                dp.IEV_U,
                dp.IEF_U,
                dp.PTOTAL_U,
                dp.SUBTOTAL,
                p.NOMBRE_PRODUCTO AS PRODUCTO
            FROM DISTRIBUCIONES d
            INNER JOIN ESTANQUES e ON d.ID_ESTANQUE = e.ID_ESTANQUE
            LEFT JOIN DETALLE_PRODUCTO dp ON dp.ID_FACTURA = d.ID_FACTURA
            LEFT JOIN PRODUCTO p ON dp.ID_PRODUCTO = p.ID_PRODUCTO
            WHERE d.ID_FACTURA = ?
        """, (factura[0],))

        distribuciones = []
        total_distribuido = 0

        for row in cur.fetchall():
            litros = float(row[3] or 0)
            total_distribuido += litros
            distribuciones.append({
                "ESTANQUE": row[0],
                "UBICACION": row[1],
                "CAPACIDAD_LITROS": float(row[2] or 0),
                "LITROS_ASIGNADOS": litros,
                "PBASE_SI_U": float(row[4] or 0),
                "IEV_U": float(row[5] or 0),
                "IEF_U": float(row[6] or 0),
                "PTOTAL_U": float(row[7] or 0),
                "SUBTOTAL": float(row[8] or 0),
                "PRODUCTO": row[9],
                "NUMERO_SOLICITUD_SAP": factura_data["NUMERO_SOLICITUD_SAP"]
            })

        conn.close()

        return jsonify({
            "factura": factura_data,
            "distribuciones": distribuciones,
            "total_distribuido": total_distribuido
        }), 200

    except Exception as e:
        print("❌ Error en seguimiento_solicitudes:", e)
        return jsonify({"error": str(e)}), 500


# ==========================================================
# 🔹 SEGUIMIENTO POR ENTRADA
# ==========================================================
@data_bp.route("/seguimiento_entradas", methods=["GET"])
def seguimiento_entradas():
    try:
        entrada_mercancia = request.args.get("entrada_mercancia")
        if not entrada_mercancia:
            return jsonify({"error": "Falta entrada_mercancia"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # === FACTURA ASOCIADA A LA SOLICITUD ===
        cur.execute("""
            SELECT 
                f.ID_FACTURA,
                f.NUMERO_FACTURA,
                f.NUMERO_SOLICITUD_SAP,
                f.NOMBRE_EMISOR,
                f.NOMBRE_RECEPTOR,
                f.RUT_EMISOR,
                f.RUT_RECEPTOR,
                f.FECHA_EMISION,
                f.BASE_AFECTA,
                f.FEEP,
                f.IEV,
                f.IEF,
                f.IVA,
                f.TOTAL,
                f.NUMERO_PEDIDO,
                f.ENTRADA_MERCANCIA,
                f.USUARIO_INGRESO,
                f.FECHA_INGRESO,
                f.HORA_INGRESO
            FROM FACTURAS f
            WHERE TRY_CAST(RTRIM(LTRIM(f.ENTRADA_MERCANCIA)) AS INT) = TRY_CAST(? AS INT)
               OR RTRIM(LTRIM(f.ENTRADA_MERCANCIA)) = ?
        """, (entrada_mercancia, entrada_mercancia))

        factura = cur.fetchone()
        if not factura:
            conn.close()
            return jsonify({"error": "No se encontró factura para esta solicitud"}), 404

        factura_data = {
            "ID_FACTURA": factura[0],
            "NUMERO_FACTURA": factura[1],
            "NUMERO_SOLICITUD_SAP": factura[2],
            "NOMBRE_EMISOR": factura[3],
            "NOMBRE_RECEPTOR": factura[4],
            "RUT_EMISOR": factura[5],
            "RUT_RECEPTOR": factura[6],
            "FECHA_EMISION": str(factura[7]) if factura[7] else None,
            "BASE_AFECTA": float(factura[8] or 0),
            "FEEP": float(factura[9] or 0),
            "IEV": float(factura[10] or 0),
            "IEF": float(factura[11] or 0),
            "IVA": float(factura[12] or 0),
            "TOTAL": float(factura[13] or 0),
            "NUMERO_PEDIDO": factura[14],
            "ENTRADA_MERCANCIA": factura[15],
            "USUARIO_INGRESO": factura[16],
            "FECHA_INGRESO": str(factura[17]) if factura[17] else None,
            "HORA_INGRESO": str(factura[18]) if factura[18] else None
        }

        # === DISTRIBUCIONES RELACIONADAS ===
        cur.execute("""
            SELECT 
                e.NOMBRE_ESTANQUE AS ESTANQUE,
                e.UBICACION,
                e.CAPACIDAD_LITROS,
                d.LITROS_ASIGNADOS,
                dp.PBASE_SI_U,
                dp.IEV_U,
                dp.IEF_U,
                dp.PTOTAL_U,
                dp.SUBTOTAL,
                p.NOMBRE_PRODUCTO AS PRODUCTO
            FROM DISTRIBUCIONES d
            INNER JOIN ESTANQUES e ON d.ID_ESTANQUE = e.ID_ESTANQUE
            LEFT JOIN DETALLE_PRODUCTO dp ON dp.ID_FACTURA = d.ID_FACTURA
            LEFT JOIN PRODUCTO p ON dp.ID_PRODUCTO = p.ID_PRODUCTO
            WHERE d.ID_FACTURA = ?
        """, (factura[0],))

        distribuciones = []
        total_distribuido = 0

        for row in cur.fetchall():
            litros = float(row[3] or 0)
            total_distribuido += litros
            distribuciones.append({
                "ESTANQUE": row[0],
                "UBICACION": row[1],
                "CAPACIDAD_LITROS": float(row[2] or 0),
                "LITROS_ASIGNADOS": litros,
                "PBASE_SI_U": float(row[4] or 0),
                "IEV_U": float(row[5] or 0),
                "IEF_U": float(row[6] or 0),
                "PTOTAL_U": float(row[7] or 0),
                "SUBTOTAL": float(row[8] or 0),
                "PRODUCTO": row[9],
                "ENTRADA_MERCANCIA": factura_data["ENTRADA_MERCANCIA"]
            })

        conn.close()

        return jsonify({
            "factura": factura_data,
            "distribuciones": distribuciones,
            "total_distribuido": total_distribuido
        }), 200

    except Exception as e:
        print("❌ Error en seguimiento_solicitudes:", e)
        return jsonify({"error": str(e)}), 500
