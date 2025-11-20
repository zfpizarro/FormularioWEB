import os
import json
import datetime

from controllers.email_sender import enviar_correo_html

from flask import Blueprint, request, jsonify
from bd import get_connection

correo_admin="descamilla@cmsg.cl"

request_user_bp = Blueprint("request_user_bp", __name__)
from controllers.email_sender import enviar_correo_html
BASE_DIR = os.path.dirname(os.path.abspath(__file__))   
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "..")) 

@request_user_bp.route("/get_solicitudes_usuario", methods=["GET"])
def get_solicitudes_usuario():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                S.ID_SOLICITUD,
                S.NUMERO_SOLICITUD,
                CASE 
                    WHEN S.ID_TIPO_SOLICITUD = 2 THEN 'Creación de Usuario'
                    WHEN S.ID_TIPO_SOLICITUD = 3 THEN 'Modificación de Usuario'
                    WHEN S.ID_TIPO_SOLICITUD = 4 THEN 'Cambio de Estado de Usuario'
                    ELSE 'Otro Tipo'
                END AS TIPO_SOLICITUD,
                S.NOMBRE_SOLICITANTE,
                S.GERENCIA,
                S.AREA,
                CONVERT(varchar, S.FECHA_SOLICITUD, 103) AS FECHA_SOLICITUD,
                S.ESTADO_SOLICITUD,
                D.NOMBRE_COMPLETO,
                D.RUT,
                D.EMAIL,
                D.CARGO,
                D.ROL AS ROL_PROPUESTO,           
                U.ROL AS ROL_ACTUAL,              
                D.NOMBRE_USUARIO,
                ISNULL(S.COMENTARIO, '') AS COMENTARIO
            FROM SOLICITUDES S
            INNER JOIN DETALLE_SOLICITUD_USUARIO D ON S.ID_SOLICITUD = D.ID_SOLICITUD
            LEFT JOIN USUARIO U ON D.NOMBRE_USUARIO = U.NOMBRE_USUARIO
            ORDER BY S.ID_SOLICITUD DESC
        """)

        rows = cursor.fetchall()
        cols = [col[0] for col in cursor.description]
        data = [dict(zip(cols, row)) for row in rows]

        return jsonify(data), 200

    except Exception as e:
        print("❌ Error al obtener solicitudes de usuario:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass


@request_user_bp.route("/insert_solicitud_usuario", methods=["POST"])
def insert_solicitud_usuario():
    try:
        data = request.get_json()
        nombreSolicitante = data.get("nombreSolicitante")
        gerencia = data.get("gerencia")
        area = data.get("area")
        fecha = data.get("fecha") or datetime.date.today()

        if isinstance(fecha, str):
            try:
                fecha_formateada = datetime.datetime.strptime(fecha, "%Y-%m-%d").strftime("%d/%m/%Y")
            except ValueError:
                fecha_formateada = fecha
        else:
            fecha_formateada = fecha.strftime("%d/%m/%Y")

        nombreCompleto = data.get("nombreCompleto")
        rut = data.get("rut")
        email = data.get("email")
        areaUsuario = data.get("areaUsuario")
        gerenciaUsuario = data.get("gerenciaUsuario")
        cargo = data.get("cargo")
        rol = data.get("rol")
        nombreUsuario = data.get("nombreUsuario")

        if not nombreSolicitante or not nombreCompleto:
            return jsonify({"error": "Faltan campos obligatorios"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT ISNULL(MAX(ID_SOLICITUD), 0) + 1 FROM SOLICITUDES")
        next_id = cursor.fetchone()[0]
        correlativo = f"U{str(next_id).zfill(4)}"

        cursor.execute("""
            INSERT INTO SOLICITUDES (
                NUMERO_SOLICITUD, ID_TIPO_SOLICITUD, NOMBRE_SOLICITANTE,
                GERENCIA, AREA, FECHA_SOLICITUD, ESTADO_SOLICITUD
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (correlativo, 2, nombreSolicitante, gerencia, area, fecha, "PENDIENTE"))

        cursor.execute("SELECT @@IDENTITY AS ID_SOLICITUD")
        id_solicitud = int(cursor.fetchone()[0])

        cursor.execute("""
            INSERT INTO DETALLE_SOLICITUD_USUARIO (
                ID_SOLICITUD, NOMBRE_COMPLETO, RUT, EMAIL, AREA, GERENCIA, CARGO, ROL, NOMBRE_USUARIO
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id_solicitud, nombreCompleto, rut, email,
            areaUsuario, gerenciaUsuario, cargo, rol, nombreUsuario
        ))

        conn.commit()

        # === Guardar JSON ===
        results_folder = os.path.join(PUBLIC_DIR, "results_request")
        os.makedirs(results_folder, exist_ok=True)
        emailSolicitante = data.get("emailSolicitante")

        json_data = {
            "ID_SOLICITUD": id_solicitud,
            "CORRELATIVO": correlativo,
            "TIPO_SOLICITUD": "Creación de Usuario",
            "FECHA_SOLICITUD": str(fecha),
            "SOLICITANTE": {
                "nombre": nombreSolicitante,
                "gerencia": gerencia,
                "area": area
            },
            "USUARIO_PROPUESTO": {
                "nombre_completo": nombreCompleto,
                "rut": rut,
                "email": email,
                "area": areaUsuario,
                "gerencia": gerenciaUsuario,
                "cargo": cargo,
                "rol": rol,
                "nombre_usuario": nombreUsuario
            },
            "ESTADO": "PENDIENTE"
        }

        with open(os.path.join(results_folder, f"Solicitud_{correlativo}.json"), "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=4)
        
        

            try:
                # Correo al solicitante
                html_solicitante = f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                    <h2 style="color: #2e7d32;">Solicitud enviada correctamente</h2>
                    <p>Estimado/a <b>{nombreSolicitante}</b>,</p>
                    <p>Tu solicitud de creación de usuario <b>{nombreCompleto}</b> ha sido recibida el día <b>{fecha_formateada}</b>.</p>
                    <p>El equipo de TI revisará tu solicitud y te notificará una vez que haya sido procesada.</p>
                    <br>
                    <p>Atentamente,<br><b>Equipo TI - CMSG</b></p>
                </body>
                </html>
                """
                enviar_correo_html(
                    [emailSolicitante],  
                    "Confirmación de envío de solicitud de usuario",
                    html_solicitante
                )

                # Correo al administrador
                html_admin = f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                    <h2 style="color: #d32f2f;">📩 Nueva Solicitud de Creación de Usuario</h2>
                    <p><b>Solicitante:</b> {nombreSolicitante}</p>
                    <p><b>Email solicitante:</b> {emailSolicitante}</p>
                    <p><b>Usuario propuesto:</b> {nombreCompleto}</p>
                    <p><b>RUT:</b> {rut}</p>
                    <p><b>Email usuario:</b> {email}</p>
                    <p><b>Área:</b> {areaUsuario}</p>
                    <p><b>Gerencia:</b> {gerenciaUsuario}</p>
                    <p><b>Cargo:</b> {cargo}</p>
                    <p><b>Rol solicitado:</b> {rol}</p>
                    <p><b>Nombre de usuario:</b> {nombreUsuario}</p>
                    <hr>
                    <p>Verifica esta solicitud en el panel de administración del sistema.</p>
                    <p><i>Fecha de recepción: {fecha_formateada}</i></p>
                </body>
                </html>
                """
                enviar_correo_html(
                    [correo_admin],  
                    "Nueva solicitud de creación de usuario pendiente",
                    html_admin
                )

            except Exception as e:
                print(f"⚠️ Error al enviar correos: {e}")



        return jsonify({
            "message": "Solicitud creada correctamente",
            "id_solicitud": id_solicitud,
            "correlativo": correlativo
        }), 200

    except Exception as e:
        print("❌ Error al crear solicitud de usuario:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

@request_user_bp.route("/update_solicitud_usuario", methods=["PUT"])
def update_solicitud_usuario():
    try:
        data = request.get_json()
        id_solicitud     = data.get("id_solicitud")
        accion           = data.get("accion")  
        comentario       = data.get("comentario", "")
        aprobado_por     = data.get("aprobado_por", "Sistema")
        emailSolicitante = (data.get("emailSolicitante") or "").strip()

        if not id_solicitud or not accion:
            return jsonify({"error": "Faltan parámetros obligatorios"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        # === Obtener tipo de solicitud ===
        cursor.execute("SELECT ID_TIPO_SOLICITUD FROM SOLICITUDES WHERE ID_SOLICITUD = ?", (id_solicitud,))
        tipo_row = cursor.fetchone()
        if not tipo_row:
            return jsonify({"error": "Solicitud no encontrada"}), 404
        tipo_solicitud = tipo_row[0]

        # === Actualizar estado y comentario ===
        cursor.execute("""
            UPDATE SOLICITUDES
            SET ESTADO_SOLICITUD = ?, 
                COMENTARIO = ?, 
                FECHA_APROBACION = GETDATE(),
                APROBADO_POR = ?
            WHERE ID_SOLICITUD = ?
        """, (accion, comentario, aprobado_por, id_solicitud))

        # === Si fue rechazada ===
        if accion == "RECHAZADO":
            cursor.execute("""
                INSERT INTO LOGS_SOLICITUDES (ID_SOLICITUD, FECHA_LOG, USUARIO_ACCION, ACCION, DESCRIPCION)
                VALUES (?, GETDATE(), ?, 'RECHAZADO', ?)
            """, (id_solicitud, aprobado_por, f"Solicitud rechazada por {aprobado_por}"))
            conn.commit()
            return jsonify({"message": "Solicitud rechazada correctamente"}), 200

        # === Si fue aprobada ===
        if accion == "APROBADO":
            cursor.execute("""
                SELECT 
                    D.ID_DETALLE_SOLICITUD,
                    D.NOMBRE_COMPLETO,
                    D.RUT,
                    D.EMAIL,       
                    D.AREA,
                    D.GERENCIA,
                    D.CARGO,
                    D.ROL,
                    D.NOMBRE_USUARIO,
                    S.NOMBRE_SOLICITANTE
                FROM DETALLE_SOLICITUD_USUARIO D
                INNER JOIN SOLICITUDES S ON S.ID_SOLICITUD = D.ID_SOLICITUD
                WHERE D.ID_SOLICITUD = ?
            """, (id_solicitud,))
            detalle = cursor.fetchone()

            if not detalle:
                return jsonify({"error": "No se encontró el detalle de la solicitud"}), 404

            (
                id_detalle,
                nombre_completo,
                rut,
                email_nuevo_usuario,
                area,
                gerencia,
                cargo,
                rol,
                nombre_usuario,
                nombre_solicitante
            ) = detalle

            # === Crear / actualizar usuario según tipo ===
            if tipo_solicitud == 2:
                cursor.execute("""
                    INSERT INTO USUARIO (
                        ID_DETALLE_SOLICITUD, NOMBRE_COMPLETO, RUT, EMAIL,
                        AREA, GERENCIA, CARGO, ROL, NOMBRE_USUARIO
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    id_detalle, nombre_completo, rut, email_nuevo_usuario,
                    area, gerencia, cargo, rol, nombre_usuario
                ))
            elif tipo_solicitud == 3:
                cursor.execute("""
                    UPDATE USUARIO
                    SET NOMBRE_COMPLETO=?, EMAIL=?, AREA=?, GERENCIA=?, 
                        CARGO=?, ROL=?
                    WHERE NOMBRE_USUARIO=?
                """, (
                    nombre_completo, email_nuevo_usuario, area, gerencia, cargo, rol, nombre_usuario
                ))

            # === Registrar log ===
            cursor.execute("""
                INSERT INTO LOGS_SOLICITUDES (ID_SOLICITUD, FECHA_LOG, USUARIO_ACCION, ACCION, DESCRIPCION)
                VALUES (?, GETDATE(), ?, 'APROBADO', ?)
            """, (
                id_solicitud,
                aprobado_por,
                f"Solicitud aprobada por {aprobado_por}"
            ))

            conn.commit()

        # En el archivo de rutas, dentro de update_solicitud_usuario
# Reemplaza la sección donde tipo_solicitud == 2:

        try:
            if tipo_solicitud == 2:
                # — Correo al nuevo usuario CON MANUAL —
                if email_nuevo_usuario and "@" in email_nuevo_usuario:
                    html_usuario = f"""
                    <html><body style="font-family: Arial;">
                        <h2 style="color:#2e7d32;">¡Bienvenido al sistema SAP!</h2>
                        <p>Estimado/a <b>{nombre_completo}</b>,</p>
                        <p>Tu cuenta ha sido creada exitosamente con los siguientes datos:</p>
                        <ul>
                            <li><b>Usuario:</b> {nombre_usuario}</li>
                            <li><b>Rol:</b> {rol}</li>
                            <li><b>Área:</b> {area}</li>
                            <li><b>Gerencia:</b> {gerencia}</li>
                        </ul>
                        <p><b>Adjuntamos el manual de acceso a la plataforma para que puedas comenzar.</b></p>
                        <br><p>Atentamente,<br>Equipo TI - CMSG</p>
                    </body></html>
                    """
                    
                    # Ruta al PDF del manual
                    ruta_pdf = os.path.join(PUBLIC_DIR, "pdf", "SAPB1_TI_PR_ACCESO_PLATAFORMA.pdf")
                    
                    enviar_correo_html(
                        [email_nuevo_usuario],
                        "Bienvenido - Creación de usuario SAP",
                        html_usuario,
                        attachments=[ruta_pdf]  # Lista de archivos adjuntos
                    )

                # — Correo al solicitante —
                if emailSolicitante:
                    html_solic = f"""
                    <html><body style="font-family: Arial;">
                        <h2 style="color:#1565c0;">Usuario creado correctamente</h2>
                        <p>Estimado/a <b>{nombre_solicitante}</b>,</p>
                        <p>La solicitud de creación para <b>{nombre_completo}</b> ha sido aprobada.</p>
                        <p>El usuario ya recibió su manual de acceso.</p>
                    </body></html>
                    """
                    enviar_correo_html(
                        [emailSolicitante],
                        f"Solicitud aprobada - Creación de usuario {nombre_completo}",
                        html_solic
                    )

            # — Correo al administrador —
            if tipo_solicitud == 3:

                if emailSolicitante:
                    html_solicitante = f"""
                    <html><body style="font-family: Arial;">
                        <h2 style="color:#1565c0;">Modificación realizada</h2>
                        <p>Estimado/a <b>{nombre_solicitante}</b>,</p>
                        <p>La solicitud de <b>modificación</b> del usuario <b>{nombre_usuario}</b> fue aprobada por <b>{aprobado_por}</b>.</p>
                        <p><b>Cambios aplicados:</b></p>
                        <ul>
                            <li><b>Nombre:</b> {nombre_completo}</li>
                            <li><b>Email:</b> {email_nuevo_usuario}</li>
                            <li><b>Área:</b> {area}</li>
                            <li><b>Gerencia:</b> {gerencia}</li>
                            <li><b>Rol:</b> {rol}</li>
                        </ul>
                    </body></html>
                    """
                    enviar_correo_html(
                        [emailSolicitante],
                        f"Solicitud aprobada - Modificación de usuario {nombre_usuario}",
                        html_solicitante
                    )

                # — Correo al administrador —
                html_admin2 = f"""
                <html><body style="font-family: Arial;">
                    <h3>🟨 Modificación completada</h3>
                    <p>Se actualizó el usuario <b>{nombre_usuario}</b> correctamente.</p>
                    <p>Aprobado por: <b>{aprobado_por}</b></p>
                </body></html>
                """
                enviar_correo_html([correo_admin],
                    f"Modificación completada - {nombre_usuario}",
                    html_admin2
                )

            if tipo_solicitud == 4:

                # — Correo al solicitante —
                if emailSolicitante:
                    html_solic = f"""
                    <html><body style="font-family: Arial;">
                        <h2 style="color:#c62828;">Cambio de estado aplicado</h2>
                        <p>Estimado/a <b>{nombre_solicitante}</b>,</p>
                        <p>La solicitud de cambio de estado para <b>{nombre_usuario}</b> fue aprobada.</p>
                        <p><b>Nuevo estado:</b> {comentario}</p>
                    </body></html>
                    """
                    enviar_correo_html(
                        [emailSolicitante],
                        f"Solicitud aprobada - Cambio de estado de {nombre_usuario}",
                        html_solic
                    )

                # — Correo al administrador —
                html_admin3 = f"""
                <html><body style="font-family: Arial;">
                    <h3>🟥 Cambio de estado aplicado</h3>
                    <p>Usuario: <b>{nombre_usuario}</b></p>
                    <p>Nuevo estado solicitado: <b>{comentario}</b></p>
                    <p>Aprobado por: {aprobado_por}</p>
                </body></html>
                """
                enviar_correo_html([correo_admin],
                    f"Cambio de estado completado - {nombre_usuario}",
                    html_admin3
        )

        except Exception as e:
            print("⚠️ Error al enviar correos:", e)



        return jsonify({"message": f"Solicitud {accion.lower()} correctamente"}), 200

    except Exception as e:
        print("❌ Error actualizando solicitud:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass


@request_user_bp.route("/get_roles", methods=["GET"])
def get_roles():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT ID_ROL, NOMBRE_ROL FROM ROL ORDER BY NOMBRE_ROL ASC")
        rows = cursor.fetchall()
        roles = [{"id": r[0], "nombre": r[1]} for r in rows]

        return jsonify(roles), 200

    except Exception as e:
        print("❌ Error al obtener roles:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass
# ======================================================
# 🔹 GENERAR NOMBRE DE USUARIO AUTOMÁTICO
# ======================================================
@request_user_bp.route("/generate_username", methods=["POST"])
def generate_username():
    try:
        data = request.get_json()
        nombre_completo = data.get("nombreCompleto", "").strip()

        if not nombre_completo:
            return jsonify({"error": "Falta el nombre completo"}), 400

        # Procesar nombre → primera letra del nombre + apellido
        partes = nombre_completo.split()
        if len(partes) < 2:
            return jsonify({"error": "Debe incluir al menos nombre y apellido"}), 400

        inicial = partes[0][0].lower()
        apellido = partes[-1].lower().replace(" ", "").replace("ñ", "n")
        base_username = f"{inicial}{apellido}"

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT NOMBRE_USUARIO FROM USUARIO WHERE NOMBRE_USUARIO LIKE ?
        """, (base_username + "%",))
        existentes = [row[0] for row in cursor.fetchall()]

        username = base_username
        contador = 1
        while username in existentes:
            username = f"{base_username}{contador}"
            contador += 1

        return jsonify({"username": username}), 200

    except Exception as e:
        print("❌ Error generando nombre de usuario:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass
# ======================================================
# 🔹 OBTENER TODOS LOS USUARIOS
# ======================================================
@request_user_bp.route("/get_usuarios", methods=["GET"])
def get_usuarios():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                U.ID_USUARIO,
                U.NOMBRE_COMPLETO,
                U.RUT,
                U.AREA,
                U.CARGO,
                U.GERENCIA,
                U.ROL
            FROM USUARIO U
            ORDER BY U.NOMBRE_COMPLETO
        """)
        rows = cursor.fetchall()
        cols = [col[0] for col in cursor.description]
        data = [dict(zip(cols, row)) for row in rows]

        return jsonify(data), 200
    except Exception as e:
        print("❌ Error al obtener usuarios:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass


# ======================================================
# 🔹 CREAR SOLICITUD DE MODIFICACIÓN DE USUARIO  (COMPLETO)
# ======================================================
@request_user_bp.route("/insert_solicitud_modificacion_usuario", methods=["POST"])
def insert_solicitud_modificacion_usuario():
    try:
        data = request.get_json()
        id_usuario        = data.get("id_usuario")
        nombre_solicitante = data.get("nombreSolicitante")
        emailSolicitante   = data.get("emailSolicitante")
        area              = data.get("area")
        gerencia          = data.get("gerencia")
        fecha             = data.get("fecha")

        if not id_usuario or not nombre_solicitante:
            return jsonify({"error": "Faltan datos obligatorios"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        # === Obtener datos actuales del usuario ===
        cursor.execute("""
            SELECT NOMBRE_COMPLETO, RUT, EMAIL, AREA, GERENCIA, CARGO, ROL, NOMBRE_USUARIO
            FROM USUARIO
            WHERE ID_USUARIO = ?
        """, (id_usuario,))
        usuario = cursor.fetchone()
        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        (
            nombre_actual, rut, email, area_actual,
            gerencia_actual, cargo_actual, rol_actual, nombre_usuario
        ) = usuario

        # === Crear correlativo ===
        cursor.execute("SELECT ISNULL(MAX(ID_SOLICITUD),0)+1 FROM SOLICITUDES")
        next_id = cursor.fetchone()[0]
        correlativo = f"R{str(next_id).zfill(4)}"

        # === Insertar cabecera de solicitud ===
        cursor.execute("""
            INSERT INTO SOLICITUDES (
                NUMERO_SOLICITUD, ID_TIPO_SOLICITUD,
                NOMBRE_SOLICITANTE, GERENCIA, AREA,
                FECHA_SOLICITUD, ESTADO_SOLICITUD, COMENTARIO
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            correlativo, 
            3,  # Modificación
            nombre_solicitante, gerencia, area,
            fecha, "PENDIENTE",
            f"Solicitud de modificación del usuario {nombre_usuario}"
        ))

        cursor.execute("SELECT @@IDENTITY AS ID_SOLICITUD")
        id_solicitud = int(cursor.fetchone()[0])

        # === Insertar detalle ===
        cursor.execute("""
            INSERT INTO DETALLE_SOLICITUD_USUARIO (
                ID_SOLICITUD, NOMBRE_COMPLETO, RUT, EMAIL,
                AREA, GERENCIA, CARGO, ROL, NOMBRE_USUARIO
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id_solicitud,
            data.get("NOMBRE_COMPLETO", nombre_actual),
            data.get("RUT", rut),
            data.get("EMAIL", email),
            data.get("AREA_USUARIO", area_actual),
            data.get("GERENCIA_USUARIO", gerencia_actual),
            data.get("CARGO", cargo_actual),
            data.get("ROL", rol_actual),
            nombre_usuario
        ))

        # === Log ===
        cursor.execute("""
            INSERT INTO LOGS_SOLICITUDES (ID_SOLICITUD, FECHA_LOG, USUARIO_ACCION, ACCION, DESCRIPCION)
            VALUES (?, GETDATE(), ?, ?, ?)
        """, (
            id_solicitud,
            nombre_solicitante,
            "CREAR_SOLICITUD_MODIFICACION",
            f"Propuesta de modificación para usuario {nombre_usuario}"
        ))

        conn.commit()

        # ==========================================================
        # 🔹 ENVÍO DE CORREOS
        # ==========================================================
        try:
            # ==== Correo al solicitante ====
            if emailSolicitante:
                html_solicitante = f"""
                <html><body style="font-family: Arial, sans-serif;">
                    <h2 style="color:#1565c0;">Solicitud enviada correctamente</h2>
                    <p>Estimado/a <b>{nombre_solicitante}</b>,</p>
                    <p>Tu solicitud de modificación del usuario <b>{nombre_usuario}</b> ha sido recibida.</p>
                    <p>El equipo TI revisará tu solicitud y te notificará cuando esté procesada.</p>
                    <br><p>Equipo TI - CMSG</p>
                </body></html>
                """
                enviar_correo_html(
                    [emailSolicitante],
                    "Confirmación de solicitud de modificación de usuario",
                    html_solicitante
                )

            # ==== Correo al administrador ====
            html_admin = f"""
            <html><body style="font-family: Arial, sans-serif;">
                <h2 style="color:#d32f2f;">📩 Nueva Solicitud de Modificación de Usuario</h2>
                <p><b>Solicitante:</b> {nombre_solicitante}</p>
                <p><b>Usuario a modificar:</b> {nombre_usuario}</p>
                <p><b>Nombre actual:</b> {nombre_actual}</p>
                <hr>
                <p>Revisa esta solicitud en el panel de administración.</p>
            </body></html>
            """
            enviar_correo_html(
                [correo_admin],
                "Nueva solicitud de modificación pendiente",
                html_admin
            )

        except Exception as e:
            print("⚠️ Error al enviar correos:", e)


        return jsonify({
            "message": f"Solicitud de modificación creada correctamente ({nombre_usuario})",
            "id_solicitud": id_solicitud
        }), 200

    except Exception as e:
        print("❌ Error al crear solicitud de modificación:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        try: cursor.close(); conn.close()
        except: pass
# ======================================================
# 🔹 CREAR SOLICITUD DE CAMBIO DE ESTADO 
# ======================================================
@request_user_bp.route("/insert_solicitud_estado_usuario", methods=["POST"])
def insert_solicitud_estado_usuario():
    try:
        data = request.get_json()
        id_usuario        = data.get("id_usuario")
        nuevo_estado      = data.get("nuevo_estado")
        comentario        = data.get("comentario", "")
        nombre_solicitante = data.get("nombreSolicitante")
        email_solicitante  = data.get("emailSolicitante")
        area              = data.get("area")
        gerencia          = data.get("gerencia")
        fecha             = data.get("fecha")

        if not id_usuario or not nuevo_estado or not nombre_solicitante:
            return jsonify({"error": "Faltan campos obligatorios"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        # === Obtener datos del usuario afectado ===
        cursor.execute("""
            SELECT NOMBRE_COMPLETO, RUT, EMAIL, AREA, GERENCIA, CARGO, ROL, NOMBRE_USUARIO
            FROM USUARIO
            WHERE ID_USUARIO = ?
        """, (id_usuario,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        (nombre, rut, email, area_u, gerencia_u, cargo, rol, nombre_usuario) = user

        # === Correlativo ===
        cursor.execute("SELECT ISNULL(MAX(ID_SOLICITUD),0)+1 FROM SOLICITUDES")
        next_id = cursor.fetchone()[0]
        correlativo = f"E{str(next_id).zfill(4)}"

        # === Insertar cabecera ===
        cursor.execute("""
            INSERT INTO SOLICITUDES (
                NUMERO_SOLICITUD, ID_TIPO_SOLICITUD, 
                NOMBRE_SOLICITANTE, GERENCIA, AREA, 
                FECHA_SOLICITUD, ESTADO_SOLICITUD, COMENTARIO
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            correlativo,
            4,
            nombre_solicitante,
            gerencia,
            area,
            fecha,
            "PENDIENTE",
            comentario
        ))

        cursor.execute("SELECT @@IDENTITY AS ID_SOLICITUD")
        id_solicitud = int(cursor.fetchone()[0])

        # === Insertar detalle ===
        cursor.execute("""
            INSERT INTO DETALLE_SOLICITUD_USUARIO (
                ID_SOLICITUD, NOMBRE_COMPLETO, RUT, EMAIL,
                AREA, GERENCIA, CARGO, ROL, NOMBRE_USUARIO
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id_solicitud, nombre, rut, email, area_u, gerencia_u,
            cargo, rol, nombre_usuario
        ))

        # === Log ===
        cursor.execute("""
            INSERT INTO LOGS_SOLICITUDES (ID_SOLICITUD, FECHA_LOG, USUARIO_ACCION, ACCION, DESCRIPCION)
            VALUES (?, GETDATE(), ?, ?, ?)
        """, (
            id_solicitud,
            nombre_solicitante,
            "CREAR_SOLICITUD_ESTADO",
            f"Solicitud para cambiar estado de {nombre_usuario} a {nuevo_estado}"
        ))

        conn.commit()

        # ==========================================================
        # 🔹 ENVÍO DE CORREOS AL CREAR LA SOLICITUD
        # ==========================================================
        try:
            # Correo al solicitante
            if email_solicitante:
                html_solicitante = f"""
                <html><body style="font-family: Arial, sans-serif;">
                    <h2 style="color:#1565c0;">Solicitud enviada correctamente</h2>
                    <p>Estimado/a <b>{nombre_solicitante}</b>,</p>
                    <p>Tu solicitud de <b>cambio de estado</b> para el usuario <b>{nombre_usuario}</b> ha sido registrada.</p>
                    <p><b>Estado solicitado:</b> {nuevo_estado}</p>
                    <p>El equipo TI revisará tu solicitud y te notificará cuando esté procesada.</p>
                    <br><p>Equipo TI - CMSG</p>
                </body></html>
                """
                enviar_correo_html(
                    [email_solicitante],
                    "Confirmación de solicitud de cambio de estado de usuario",
                    html_solicitante
                )

            # Correo al administrador
            html_admin = f"""
            <html><body style="font-family: Arial, sans-serif;">
                <h2 style="color:#d32f2f;">📩 Nueva Solicitud de Cambio de Estado de Usuario</h2>
                <p><b>Solicitante:</b> {nombre_solicitante}</p>
                <p><b>Usuario afectado:</b> {nombre_usuario}</p>
                <p><b>Estado solicitado:</b> {nuevo_estado}</p>
                <p><b>Comentario:</b> {comentario or 'Sin comentario adicional.'}</p>
                <hr>
                <p>Revisa esta solicitud en el panel de administración.</p>
            </body></html>
            """
            enviar_correo_html(
                [correo_admin],
                "Nueva solicitud de cambio de estado pendiente",
                html_admin
            )

        except Exception as e:
            print("⚠️ Error al enviar correos (cambio de estado):", e)

        return jsonify({
            "message": f"Solicitud de cambio de estado creada correctamente ({nombre_usuario})",
            "id_solicitud": id_solicitud
        }), 200

    except Exception as e:
        print("❌ Error al crear solicitud de cambio de estado:", e)
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass
