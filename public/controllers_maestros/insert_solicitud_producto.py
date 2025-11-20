import os
import datetime
from flask import Blueprint, request, jsonify
from bd import get_connection

insert_solicitud_producto_bp = Blueprint("insert_solicitud_producto", __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_COTIZACION_FOLDER = r"C:\Users\fpizarro\Desktop\Excelsior\upload_cotizacion"

os.makedirs(UPLOAD_COTIZACION_FOLDER, exist_ok=True)


def generar_numero_solicitud(cursor):
    cursor.execute("SELECT TOP 1 NUMERO_SOLICITUD FROM SOLICITUDES ORDER BY ID_SOLICITUD DESC")
    last = cursor.fetchone()
    if last and last[0]:
        try:
            num = int(last[0][1:]) + 1
        except:
            num = 1
    else:
        num = 1
    return f"S{num:05d}"


@insert_solicitud_producto_bp.route("/insert_solicitud_producto", methods=["POST"])
def insert_solicitud_producto():
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT TOP 1 ID_TIPO_SOLICITUD 
            FROM TIPO_SOLICITUD 
            WHERE NOMBRE_TIPO LIKE 'Maestro de Producto'
            ORDER BY ID_TIPO_SOLICITUD DESC
        """)
        tipo_row = cur.fetchone()
        if not tipo_row:
            return jsonify({"status": "error", "message": "No se encontró el tipo 'Maestro de Producto'."}), 400
        id_tipo_solicitud = tipo_row[0]

        data = request.form.to_dict()
        file = request.files.get("archivo")

        nombre = data.get("nombreSolicitante")
        gerencia = data.get("gerencia")
        area = data.get("area")
        fecha = data.get("fecha") or datetime.date.today()
        numero_solicitud = generar_numero_solicitud(cur)

        cur.execute("""
            INSERT INTO SOLICITUDES 
                (NUMERO_SOLICITUD, ID_TIPO_SOLICITUD, NOMBRE_SOLICITANTE, GERENCIA, AREA, FECHA_SOLICITUD, ESTADO_SOLICITUD)
            OUTPUT INSERTED.ID_SOLICITUD
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            numero_solicitud,
            id_tipo_solicitud,
            nombre,
            gerencia,
            area,
            fecha,
            "PENDIENTE"
        ))

        row = cur.fetchone()
        id_solicitud = int(row[0]) if row and row[0] is not None else None
        conn.commit()

        cur.execute("""
            INSERT INTO DETALLE_SOLICITUD_PRODUCTO (
                ID_SOLICITUD, DETALLE_SOLICITUD, UNIDAD_MEDIDA, FABRICACION, 
                TIPO_MATERIAL, GRUPO_ARTICULO, CRITICIDAD, TIPO_REPOSICION,
                NUMERO_PARTE_PLANO, FABRICANTE_MARCA, CONSUMO_MENSUAL, 
                PRECIO_UNITARIO, MONEDA
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id_solicitud,
            data.get("detalleSolicitud"),
            data.get("unidadMedida"),
            data.get("fabricacion"),
            data.get("tipoMaterial"),
            data.get("grupoArticulo"),
            data.get("criticidad"),
            data.get("tipoReposicion"),
            data.get("numeroParte"),
            data.get("fabricante"),
            data.get("consumo"),
            data.get("precioUnitario"),
            data.get("moneda")
        ))

        if file:
            filename = f"COTIZACION_{numero_solicitud}_{file.filename}"
            save_path = os.path.join(UPLOAD_COTIZACION_FOLDER, filename)
            file.save(save_path)

        cur.execute("""
            INSERT INTO LOGS_SOLICITUDES (ID_SOLICITUD, USUARIO_ACCION, ACCION, DESCRIPCION)
            VALUES (?, ?, ?, ?)
        """, (
            id_solicitud,
            nombre,
            "CREACIÓN",
            f"Solicitud {numero_solicitud} creada correctamente por {nombre}."
        ))

        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": f"✅ Solicitud creada correctamente (N° {numero_solicitud})",
            "numeroSolicitud": numero_solicitud
        }), 200

    except Exception as e:
        print("❌ Error al crear solicitud:", e)
        return jsonify({
            "status": "error",
            "message": f"Error al crear solicitud: {str(e)}"
        }), 500
