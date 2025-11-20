from flask import Blueprint, jsonify
from bd import get_connection

get_solicitudes_maestro_bp = Blueprint("get_solicitudes_maestro", __name__)

@get_solicitudes_maestro_bp.route("/get_solicitudes_maestro", methods=["GET"])
def get_solicitudes_maestro():
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT 
                S.ID_SOLICITUD,
                S.NUMERO_SOLICITUD,
                S.NOMBRE_SOLICITANTE,
                S.GERENCIA,
                S.AREA,
                CONVERT(VARCHAR(10), S.FECHA_SOLICITUD, 103) AS FECHA_SOLICITUD,
                S.ESTADO_SOLICITUD,
                D.DETALLE_SOLICITUD,
                D.UNIDAD_MEDIDA,
                D.FABRICACION,
                D.TIPO_MATERIAL,
                D.GRUPO_ARTICULO,
                D.CRITICIDAD,
                D.TIPO_REPOSICION,
                D.NUMERO_PARTE_PLANO,
                D.FABRICANTE_MARCA,
                D.CONSUMO_MENSUAL,
                D.PRECIO_UNITARIO,
                D.MONEDA
            FROM SOLICITUDES S
            JOIN DETALLE_SOLICITUD_PRODUCTO D ON S.ID_SOLICITUD = D.ID_SOLICITUD
            JOIN TIPO_SOLICITUD T ON S.ID_TIPO_SOLICITUD = T.ID_TIPO_SOLICITUD
            WHERE T.NOMBRE_TIPO LIKE 'Maestro de Producto'
            ORDER BY S.FECHA_SOLICITUD DESC
        """)

        rows = cur.fetchall()
        conn.close()

        data = []
        for r in rows:
            data.append({
                "id_solicitud": r[0],
                "numero_solicitud": r[1],
                "nombre_solicitante": r[2],
                "gerencia": r[3],
                "area": r[4],
                "fecha_solicitud": r[5],
                "estado": r[6],
                "detalle_solicitud": r[7],
                "unidad_medida": r[8],
                "fabricacion": r[9],
                "tipo_material": r[10],
                "grupo_articulo": r[11],
                "criticidad": r[12],
                "tipo_reposicion": r[13],
                "numero_parte_plano": r[14],
                "fabricante_marca": r[15],
                "consumo": float(r[16]) if r[16] else None,
                "precio_unitario": float(r[17]) if r[17] else None,
                "moneda": r[18],
            })

        return jsonify(data), 200

    except Exception as e:
        print("Error al obtener solicitudes maestro:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
