import bcrypt
from flask import Blueprint, request, jsonify
from bd import get_connection
from datetime import datetime

users_bp = Blueprint("users_bp", __name__)

@users_bp.route("/register_user", methods=["POST"])
def register_user():
    data = request.get_json()
    try:
        nombre = data.get("nombre")
        rut = data.get("rut")
        email = data.get("email")
        gerencia = data.get("gerencia")
        area = data.get("area")
        cargo = data.get("cargo")
        nombre_usuario = data.get("nombre_usuario")
        password = data.get("password")
        rol = data.get("rol")
        activo = 1 if data.get("activo") else 0
        estanques = data.get("estanques", [])  

        if not all([nombre, email, nombre_usuario, password, rol]):
            return jsonify({"status": "error", "message": "Faltan campos obligatorios"}), 400

        hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        conn = get_connection()
        cur = conn.cursor()

        # === 1. Insertar usuario ===
        cur.execute("""
            INSERT INTO dbo.USUARIO_SISTEMA
            (NOMBRE_COMPLETO, RUT, EMAIL, GERENCIA, AREA, CARGO,
             NOMBRE_USUARIO, CONTRASENA_HASH, MODO_AUTENTICACION, ACTIVO, FECHA_CREACION)
            OUTPUT INSERTED.ID_USUARIO_SISTEMA
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        """, (
            nombre, rut, email, gerencia, area, cargo,
            nombre_usuario, hashed_password, "LOCAL", activo
        ))

        id_usuario = cur.fetchone()[0]

        # === 2. Asignar rol ===
        cur.execute("SELECT ID_ROL_SISTEMA FROM ROL_SISTEMA WHERE NOMBRE_ROL_SISTEMA = ?", (rol,))
        rol_row = cur.fetchone()
        
        if not rol_row:
            conn.rollback()
            return jsonify({"status": "error", "message": f"El rol '{rol}' no existe en la base de datos"}), 404
        
        id_rol = rol_row[0]
        
        cur.execute("""
            INSERT INTO USUARIO_ROL_SISTEMA 
            (ID_USUARIO_SISTEMA, ID_ROL_SISTEMA, ASIGNADO_POR, FECHA_ASIGNACION)
            VALUES (?, ?, ?, GETDATE())
        """, (id_usuario, id_rol, "admin@cmsg.cl"))

        # === 3. Si es BODEGA, asignar estanques ===
        if rol == "BODEGA" and estanques:
            for id_estanque in estanques:
                cur.execute("""
                    INSERT INTO USUARIO_SISTEMA_ESTANQUE 
                    (ID_USUARIO_SISTEMA, ID_ESTANQUE, FECHA_ASIGNACION, ACTIVO)
                    VALUES (?, ?, GETDATE(), 1)
                """, (id_usuario, id_estanque))

        conn.commit()
        return jsonify({
            "status": "ok", 
            "message": "Usuario creado correctamente",
            "id_usuario": id_usuario
        }), 200

    except Exception as e:
        print("❌ Error register_user:", e)
        if 'conn' in locals():
            conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()


# === Obtener todos los usuarios con sus estanques ===
@users_bp.route("/usuarios", methods=["GET"])
def get_usuarios():
    """
    Devuelve una lista de todos los usuarios del sistema con su rol, estado y estanques asignados.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Obtener usuarios con sus roles
        cursor.execute("""
            SELECT 
                U.ID_USUARIO_SISTEMA,
                U.NOMBRE_COMPLETO,
                U.EMAIL,
                U.RUT,
                U.GERENCIA,
                U.AREA,
                U.CARGO,
                U.NOMBRE_USUARIO,
                RS.NOMBRE_ROL_SISTEMA,
                U.ACTIVO,
                CONVERT(VARCHAR(10), U.FECHA_CREACION, 103) AS FECHA_CREACION
            FROM USUARIO_SISTEMA U
            LEFT JOIN USUARIO_ROL_SISTEMA URS ON U.ID_USUARIO_SISTEMA = URS.ID_USUARIO_SISTEMA
            LEFT JOIN ROL_SISTEMA RS ON URS.ID_ROL_SISTEMA = RS.ID_ROL_SISTEMA
            ORDER BY U.ID_USUARIO_SISTEMA DESC
        """)
        rows = cursor.fetchall()
        
        usuarios = []
        for r in rows:
            id_usuario = r[0]
            
            # Obtener estanques asignados a este usuario
            cursor.execute("""
                SELECT 
                    E.ID_ESTANQUE,
                    E.NOMBRE_ESTANQUE,
                    E.UBICACION,
                    E.CAPACIDAD_LITROS
                FROM USUARIO_SISTEMA_ESTANQUE USE_TABLE
                INNER JOIN ESTANQUES E ON USE_TABLE.ID_ESTANQUE = E.ID_ESTANQUE
                WHERE USE_TABLE.ID_USUARIO_SISTEMA = ? AND USE_TABLE.ACTIVO = 1
            """, (id_usuario,))
            
            estanques_rows = cursor.fetchall()
            estanques = [
                {
                    "id": est[0],
                    "nombre": est[1],
                    "ubicacion": est[2],
                    "capacidad": float(est[3]) if est[3] else 0
                }
                for est in estanques_rows
            ]
            
            usuarios.append({
                "id": id_usuario,
                "nombre": r[1],
                "email": r[2],
                "rut": r[3],
                "gerencia": r[4],
                "area": r[5],
                "cargo": r[6],
                "nombre_usuario": r[7],
                "rol": r[8],
                "estado": "Activo" if r[9] else "Inactivo",
                "fecha_creacion": r[10],
                "estanques": estanques
            })
        
        return jsonify(usuarios)
        
    except Exception as e:
        print("❌ Error get_usuarios:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()


# === Obtener lista de todos los estanques disponibles ===
@users_bp.route("/estanques_disponibles", methods=["GET"])
def get_estanques_disponibles():
    """
    Devuelve todos los estanques disponibles en el sistema.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                ID_ESTANQUE,
                NOMBRE_ESTANQUE,
                UBICACION,
                CAPACIDAD_LITROS
            FROM ESTANQUES
            ORDER BY UBICACION, NOMBRE_ESTANQUE
        """)
        
        rows = cursor.fetchall()
        estanques = [
            {
                "id": r[0],
                "nombre": r[1],
                "ubicacion": r[2],
                "capacidad": float(r[3]) if r[3] else 0
            }
            for r in rows
        ]
        
        return jsonify(estanques)
        
    except Exception as e:
        print("❌ Error get_estanques_disponibles:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()


# === Actualizar usuario ===
@users_bp.route("/update_user/<int:id_usuario>", methods=["PUT"])
def update_user(id_usuario):
    """
    Actualiza los datos de un usuario (nombre, correo, rol, estado, estanques, etc.)
    """
    try:
        data = request.get_json()
        nombre = data.get("nombre")
        email = data.get("email")
        rut = data.get("rut")
        gerencia = data.get("gerencia")
        area = data.get("area")
        cargo = data.get("cargo")
        nombre_usuario = data.get("nombre_usuario")
        password = data.get("password")
        rol = data.get("rol")
        activo = data.get("activo", True)
        estanques = data.get("estanques", [])  # Lista de IDs de estanques

        conn = get_connection()
        cursor = conn.cursor()

        # === 1. Actualizar información general ===
        if password:
            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cursor.execute("""
                UPDATE USUARIO_SISTEMA
                SET NOMBRE_COMPLETO=?, RUT=?, EMAIL=?, GERENCIA=?, AREA=?, CARGO=?, 
                    NOMBRE_USUARIO=?, CONTRASENA_HASH=?, ACTIVO=?
                WHERE ID_USUARIO_SISTEMA=?
            """, (nombre, rut, email, gerencia, area, cargo, nombre_usuario, hashed, 1 if activo else 0, id_usuario))
        else:
            cursor.execute("""
                UPDATE USUARIO_SISTEMA
                SET NOMBRE_COMPLETO=?, RUT=?, EMAIL=?, GERENCIA=?, AREA=?, CARGO=?, 
                    NOMBRE_USUARIO=?, ACTIVO=?
                WHERE ID_USUARIO_SISTEMA=?
            """, (nombre, rut, email, gerencia, area, cargo, nombre_usuario, 1 if activo else 0, id_usuario))

        # === 2. Actualizar rol ===
        if rol:
            cursor.execute("SELECT ID_ROL_SISTEMA FROM ROL_SISTEMA WHERE NOMBRE_ROL_SISTEMA = ?", (rol,))
            rol_row = cursor.fetchone()
            
            if not rol_row:
                conn.rollback()
                return jsonify({"status": "error", "message": f"El rol '{rol}' no existe"}), 404
            
            id_rol = rol_row[0]

            # Actualiza o inserta si no existe
            cursor.execute("""
                MERGE USUARIO_ROL_SISTEMA AS TARGET
                USING (SELECT ? AS ID_USUARIO_SISTEMA) AS SOURCE
                ON TARGET.ID_USUARIO_SISTEMA = SOURCE.ID_USUARIO_SISTEMA
                WHEN MATCHED THEN
                    UPDATE SET ID_ROL_SISTEMA = ?, FECHA_ASIGNACION = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (ID_USUARIO_SISTEMA, ID_ROL_SISTEMA, ASIGNADO_POR, FECHA_ASIGNACION)
                    VALUES (?, ?, ?, GETDATE());
            """, (id_usuario, id_rol, id_usuario, id_rol, "admin@cmsg.cl"))

        # === 3. Actualizar estanques (solo si es BODEGA) ===
        if rol == "BODEGA":
            # Desactivar todos los estanques actuales
            cursor.execute("""
                UPDATE USUARIO_SISTEMA_ESTANQUE
                SET ACTIVO = 0
                WHERE ID_USUARIO_SISTEMA = ?
            """, (id_usuario,))
            
            # Asignar los nuevos estanques
            for id_estanque in estanques:
                # Verificar si ya existe la relación
                cursor.execute("""
                    SELECT ID_USUARIO_SISTEMA_ESTANQUE 
                    FROM USUARIO_SISTEMA_ESTANQUE
                    WHERE ID_USUARIO_SISTEMA = ? AND ID_ESTANQUE = ?
                """, (id_usuario, id_estanque))
                
                if cursor.fetchone():
                    # Si existe, reactivarla
                    cursor.execute("""
                        UPDATE USUARIO_SISTEMA_ESTANQUE
                        SET ACTIVO = 1, FECHA_ASIGNACION = GETDATE()
                        WHERE ID_USUARIO_SISTEMA = ? AND ID_ESTANQUE = ?
                    """, (id_usuario, id_estanque))
                else:
                    # Si no existe, crearla
                    cursor.execute("""
                        INSERT INTO USUARIO_SISTEMA_ESTANQUE 
                        (ID_USUARIO_SISTEMA, ID_ESTANQUE, FECHA_ASIGNACION, ACTIVO)
                        VALUES (?, ?, GETDATE(), 1)
                    """, (id_usuario, id_estanque))
        else:
            # Si cambió de rol y ya no es BODEGA, desactivar todos sus estanques
            cursor.execute("""
                UPDATE USUARIO_SISTEMA_ESTANQUE
                SET ACTIVO = 0
                WHERE ID_USUARIO_SISTEMA = ?
            """, (id_usuario,))

        conn.commit()
        return jsonify({"status": "ok", "message": "Usuario actualizado correctamente"})

    except Exception as e:
        print("❌ Error update_user:", e)
        if 'conn' in locals():
            conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()


# === Eliminar usuario ===
@users_bp.route("/delete_user/<int:id_usuario>", methods=["DELETE"])
def delete_user(id_usuario):
    """
    Elimina completamente al usuario del sistema.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # 1. Eliminar estanques asignados
        cursor.execute("DELETE FROM USUARIO_SISTEMA_ESTANQUE WHERE ID_USUARIO_SISTEMA = ?", (id_usuario,))
        
        # 2. Eliminar rol asociado
        cursor.execute("DELETE FROM USUARIO_ROL_SISTEMA WHERE ID_USUARIO_SISTEMA = ?", (id_usuario,))
        
        # 3. Eliminar el usuario
        cursor.execute("DELETE FROM USUARIO_SISTEMA WHERE ID_USUARIO_SISTEMA = ?", (id_usuario,))
        
        conn.commit()
        return jsonify({"status": "ok", "message": "Usuario eliminado correctamente"})

    except Exception as e:
        print("❌ Error delete_user:", e)
        if 'conn' in locals():
            conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()


# === Obtener estanques de un usuario específico ===
@users_bp.route("/usuario/<int:id_usuario>/estanques", methods=["GET"])
def get_usuario_estanques(id_usuario):
    """
    Obtiene los estanques asignados a un usuario específico.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                E.ID_ESTANQUE,
                E.NOMBRE_ESTANQUE,
                E.UBICACION,
                E.CAPACIDAD_LITROS
            FROM USUARIO_SISTEMA_ESTANQUE USE_TABLE
            INNER JOIN ESTANQUES E ON USE_TABLE.ID_ESTANQUE = E.ID_ESTANQUE
            WHERE USE_TABLE.ID_USUARIO_SISTEMA = ? AND USE_TABLE.ACTIVO = 1
            ORDER BY E.UBICACION, E.NOMBRE_ESTANQUE
        """, (id_usuario,))
        
        rows = cursor.fetchall()
        estanques = [
            {
                "id": r[0],
                "nombre": r[1],
                "ubicacion": r[2],
                "capacidad": float(r[3]) if r[3] else 0
            }
            for r in rows
        ]
        
        return jsonify(estanques)
        
    except Exception as e:
        print("❌ Error get_usuario_estanques:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()