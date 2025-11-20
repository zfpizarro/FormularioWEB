import os
import json
from flask import Blueprint, request, jsonify
from bd import get_connection

update_solicitud_maestro_bp = Blueprint("update_solicitud_maestro", __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_REQUEST_FOLDER = r"C:\Users\fpizarro\Desktop\Excelsior\upload_cotizacion"
os.makedirs(RESULTS_REQUEST_FOLDER, exist_ok=True)

@update_solicitud_maestro_bp.route("/update_solicitud_maestro", methods=["POST"])
def update_solicitud_maestro():
    try:
        conn = get_connection()
        cur = conn.cursor()

        data = request.get_json()
        id_solicitud = data.get("id_solicitud")
        accion = data.get("accion")
        comentario = data.get("comentario")

        if accion == "APROBAR":
            nuevo_estado = "Aprobado"
        elif accion == "RECHAZAR":
            nuevo_estado = "Rechazado"
        else:
            return jsonify({"status": "error", "message": "Acción inválida."}), 400

        cur.execute("""
            UPDATE SOLICITUDES
            SET ESTADO_SOLICITUD = ?, COMENTARIO = ?, FECHA_APROBACION = GETDATE()
            WHERE ID_SOLICITUD = ?
        """, (nuevo_estado, comentario, id_solicitud))

        if accion == "APROBAR":
            cur.execute("""
                SELECT S.NUMERO_SOLICITUD, S.NOMBRE_SOLICITANTE, S.GERENCIA, S.AREA, 
                       D.DETALLE_SOLICITUD, D.UNIDAD_MEDIDA, D.FABRICACION, 
                       D.TIPO_MATERIAL, D.GRUPO_ARTICULO, D.CRITICIDAD, 
                       D.TIPO_REPOSICION, D.NUMERO_PARTE_PLANO, D.FABRICANTE_MARCA, 
                       D.CONSUMO_MENSUAL, D.PRECIO_UNITARIO, D.MONEDA
                FROM SOLICITUDES S
                JOIN DETALLE_SOLICITUD_PRODUCTO D ON S.ID_SOLICITUD = D.ID_SOLICITUD
                WHERE S.ID_SOLICITUD = ?
            """, (id_solicitud,))
            row = cur.fetchone()
            if row:
                json_data = {
                    "solicitud": {
                        "numero": row[0],
                        "solicitante": row[1],
                        "gerencia": row[2],
                        "area": row[3],
                    },
                    "producto": {
                        "detalle": row[4],
                        "unidad_medida": row[5],
                        "fabricacion": row[6],
                        "tipo_material": row[7],
                        "grupo_articulo": row[8],
                        "criticidad": row[9],
                        "tipo_reposicion": row[10],
                        "numero_parte": row[11],
                        "fabricante": row[12],
                        "consumo_mensual": float(row[13]) if row[13] else None,
                        "precio_unitario": float(row[14]) if row[14] else None,
                        "moneda": row[15],
                    }
                }

                filename = f"solicitud_{row[0]}.json"
                with open(os.path.join(RESULTS_REQUEST_FOLDER, filename), "w", encoding="utf-8") as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=4)

        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"Solicitud {accion.lower()} correctamente."}), 200

    except Exception as e:
        print("Error al actualizar solicitud:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
