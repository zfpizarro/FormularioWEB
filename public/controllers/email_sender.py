# controllers/email_sender.py
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

SMTP_CONFIG = {
    'servidor': os.getenv('SMTP_SERVER', 'smtp.office365.com'),
    'puerto': int(os.getenv('SMTP_PORT', 587)),
    'usuario': os.getenv('SMTP_USER', 'notificaciones@cmsg.cl'),
    'password': os.getenv('SMTP_PASSWORD', ''),
    'usar_tls': os.getenv('SMTP_USE_TLS', 'True').lower() == 'true',
}

def enviar_correo_html(destinatarios, asunto, html_body, attachments=None):
    """
    Envía un correo HTML con soporte opcional para adjuntar archivos PDF.
    Configuración SMTP obtenida desde variables de entorno.
    """
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_CONFIG['usuario']
        msg['To'] = ', '.join(destinatarios)
        msg['Subject'] = asunto
        msg.attach(MIMEText(html_body, 'html'))

        # === Adjuntar archivos (por ejemplo, manual PDF) ===
        if attachments:
            for file_path in attachments:
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        part = MIMEApplication(f.read(), _subtype="pdf")
                        part.add_header(
                            "Content-Disposition",
                            f"attachment; filename={os.path.basename(file_path)}"
                        )
                        msg.attach(part)
                else:
                    print(f"⚠️ Archivo no encontrado para adjuntar: {file_path}")

        # === Conexión SMTP ===
        server = smtplib.SMTP(SMTP_CONFIG['servidor'], SMTP_CONFIG['puerto'])
        if SMTP_CONFIG['usar_tls']:
            server.starttls()
        server.login(SMTP_CONFIG['usuario'], SMTP_CONFIG['password'])
        server.send_message(msg)
        server.quit()

        print(f"✅ Correo enviado correctamente a {destinatarios}")
        return True

    except Exception as e:
        print(f"❌ Error al enviar correo: {e}")
        return False
