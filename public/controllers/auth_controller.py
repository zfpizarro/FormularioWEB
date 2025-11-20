import bcrypt
import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from bd import get_connection

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        rut = data.get("rut")
        password = data.get("password")
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                ID_USUARIO_SISTEMA,
                NOMBRE_COMPLETO,
                RUT,
                EMAIL,
                GERENCIA,
                AREA,
                CONTRASENA_HASH,
                ACTIVO
            FROM USUARIO_SISTEMA
            WHERE RUT = ?
        """, (rut,))
        
        user = cursor.fetchone()
        if not user:
            return jsonify({"status": "error", "message": "Usuario no encontrado"}), 404

        id_usuario, nombre, rut_bd, email, gerencia, area, contrasena_hash, activo = user

        if not activo:
            return jsonify({"status": "error", "message": "Usuario deshabilitado"}), 403

        if not contrasena_hash:
            return jsonify({"status": "error", "message": "Usuario sin contraseña registrada"}), 400

        if isinstance(contrasena_hash, bytes):
            hash_bytes = contrasena_hash
        else:
            hash_bytes = contrasena_hash.encode("utf-8")

        password_valido = bcrypt.checkpw(password.encode("utf-8"), hash_bytes)
        if not password_valido:
            return jsonify({"status": "error", "message": "Contraseña incorrecta"}), 401

        cursor.execute("""
            SELECT RS.NOMBRE_ROL_SISTEMA
            FROM USUARIO_ROL_SISTEMA URS
            JOIN ROL_SISTEMA RS ON URS.ID_ROL_SISTEMA = RS.ID_ROL_SISTEMA
            WHERE URS.ID_USUARIO_SISTEMA = ?
        """, (id_usuario,))
        
        roles = [row[0] for row in cursor.fetchall()]

        try:
            cursor.execute("""
                SELECT 
                    E.UBICACION,
                    E.NOMBRE_ESTANQUE
                FROM USUARIO_SISTEMA_ESTANQUE UE
                JOIN ESTANQUES E ON UE.ID_ESTANQUE = E.ID_ESTANQUE
                WHERE UE.ID_USUARIO_SISTEMA = ? AND UE.ACTIVO = 1
            """, (id_usuario,))
            estanques = [{"codigo": row[0], "nombre": row[1]} for row in cursor.fetchall()]
        except Exception as e:
            print("Error al obtener estanques:", e)
            estanques = []
        access_token = create_access_token(
            identity={
                "id": id_usuario,
                "nombre": nombre,
                "roles": roles
            },
            expires_delta=datetime.timedelta(hours=4)
        )

        conn.close()
        return jsonify({
            "status": "ok",
            "token": access_token,
            "usuario": nombre,
            "roles": roles,
            "gerencia": gerencia,
            "area": area,
            "email": email,
            "estanques": estanques
        })

    except Exception as e:
        print("ERROR EN /login:", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route("/validate_session", methods=["GET"])
@jwt_required()
def validate_session():
    user = get_jwt_identity()
    return jsonify({"status": "ok", "user": user})

@auth_bp.route("/dashboard_protegido", methods=["GET"])
@jwt_required()
def dashboard_protegido():
    user = get_jwt_identity()
    return jsonify({"message": f"Hola {user['nombre']}, accediste al dashboard protegido!"})
