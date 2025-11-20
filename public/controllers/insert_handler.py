import datetime
from flask import Blueprint, request, jsonify
from bd import get_connection
from controllers.validations import parse_fecha, validar_estanques, litros_totales_factura

insert_bp = Blueprint("insert_bp", __name__)

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

        # === Validaciones ===
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

        fecha_ingreso = datetime.date.today()
        hora_ingreso = datetime.datetime.now().strftime("%H:%M:%S")
        usuario_ingreso = "usuario_prueba" # Aquí se podría obtener del token o sesión

        conn = get_connection()
        cur = conn.cursor()

        # === Insertar factura principal ===
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
            factura.get("RUT_RECEPTOR"),
            factura.get("Nombre_Receptor"),
            factura.get("Direccion_Receptor"),
            factura.get("Despacho_Receptor"),
            (factura.get("Detalle de Pago") or {}).get("Base Afecta", 0),
            (factura.get("Detalle de Pago") or {}).get("FEEP", 0),
            (factura.get("Detalle de Pago") or {}).get("IEV", 0),
            (factura.get("Detalle de Pago") or {}).get("IEF", 0),
            (factura.get("Detalle de Pago") or {}).get("IVA", 0),
            (factura.get("Detalle de Pago") or {}).get("Total", 0),
            usuario_ingreso,
            fecha_ingreso,
            hora_ingreso
        ))

        id_factura = cur.fetchone()[0]

        # === Detalle productos ===
        for det in (factura.get("Detalle de productos") or []):
            nombre_producto = det.get("Nombre del producto", "SIN NOMBRE")
            cur.execute("SELECT ID_PRODUCTO FROM PRODUCTO WHERE NOMBRE_PRODUCTO = ?", nombre_producto)
            row = cur.fetchone()

            if row:
                id_producto = row[0]
            else:
                cur.execute("INSERT INTO PRODUCTO (NOMBRE_PRODUCTO) OUTPUT INSERTED.ID_PRODUCTO VALUES (?)", nombre_producto)
                id_producto = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO DETALLE_PRODUCTO (
                    CANTIDAD, PBASE_SI_U, IEV_U, IEF_U, PTOTAL_U, SUBTOTAL,
                    ID_PRODUCTO, ID_FACTURA
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                det.get("Cantidad (litros)", 0),
                det.get("PBASE_SI_U", 0),
                det.get("IEV U", 0),
                det.get("IEF U", 0),
                det.get("PTOTAL U", 0),
                det.get("SUBTOTAL U", 0),
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
        conn.close()

        return jsonify({
            "status": "ok",
            "mensaje": f"Factura insertada correctamente con Solicitud SAP {numero_solicitud_sap}",
            "id_factura": id_factura,
            "numero_solicitud_sap": numero_solicitud_sap
        }), 200

    except Exception as e:
        print(f"❌ Error insert_factura: {e}")
        return jsonify({"error": str(e)}), 500
