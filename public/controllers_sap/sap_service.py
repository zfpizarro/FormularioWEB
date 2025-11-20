import os
import requests
import json
import urllib3
from dotenv import load_dotenv


from flask import Blueprint, jsonify
from bd import get_connection


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

class SAPServiceLayer:
    def __init__(self):
        self.base_url = os.getenv("SAP_URL")
        self.company = os.getenv("SAP_COMPANY")
        self.user = os.getenv("SAP_USERNAME")
        self.password = os.getenv("SAP_PASSWORD")
        self.session = requests.Session()
        self.cookies = None
        self.logged_in = False

    # === LOGIN ===
    def login(self):
        if self.logged_in and self.cookies:
            return True

        payload = {
            "CompanyDB": self.company,
            "UserName": self.user,
            "Password": self.password,
        }

        try:
            print(f"🔐 Iniciando sesión SAP en: {self.base_url}/Login")
            r = self.session.post(f"{self.base_url}/Login", json=payload, verify=False)
            if r.status_code == 200:
                self.cookies = r.cookies
                self.logged_in = True
                print(f"✅ Sesión SAP iniciada ({self.user}) — duración 30 min")
                return True
            else:
                print(f"❌ Error login SAP: {r.text}")
                return False
        except Exception as e:
            print("❌ Error al conectar con SAP:", e)
            return False
        
    def _ensure_session(self):
        if not self.logged_in or not self.cookies:
            self.login()

    def get(self, endpoint):
        self._ensure_session()
        try:
            url = f"{self.base_url}/{endpoint}"
            r = self.session.get(url, cookies=self.cookies, verify=False)

            if r.status_code == 200:
                return True, r.json()
            elif r.status_code == 301:
                print("⚠️ Sesión SAP expirada (GET). Reautenticando...")
                self.logged_in = False
                self.login()
                r = self.session.get(url, cookies=self.cookies, verify=False)
                return True, r.json()
            else:
                print(f"❌ Error GET SAP: {r.text}")
                return False, r.text

        except Exception as e:
            print("❌ Error GET SAP:", e)
            return False, str(e)

    def post(self, endpoint, payload):
        self._ensure_session()
        try:
            url = f"{self.base_url}/{endpoint}"
            r = self.session.post(url, json=payload, cookies=self.cookies, verify=False)

            if r.status_code in [200, 201]:
                try:
                    return True, r.json()
                except Exception:
                    return True, {"status": "ok", "mensaje": "Operación completada, sin cuerpo JSON."}
            elif r.status_code == 301:
                print("⚠️ Sesión SAP expirada (POST). Reautenticando...")
                self.logged_in = False
                self.login()
                r = self.session.post(url, json=payload, cookies=self.cookies, verify=False)
                if r.status_code in [200, 201]:
                    return True, r.json()
                else:
                    print(f"❌ Error POST SAP tras reintentar: {r.text}")
                    return False, r.json() if r.text else {"error": "Error desconocido tras reautenticación"}

            else:
                print(f"❌ Error POST SAP: {r.text}")
                try:
                    return False, r.json()
                except Exception:
                    return False, {"error": r.text}

        except Exception as e:
            return False, {"error": str(e)}


    def patch(self, endpoint, payload):
        self._ensure_session()
        try:
            url = f"{self.base_url}/{endpoint}"
            headers = {"B1S-ReplaceCollectionsOnPatch": "true"}

            r = self.session.patch(url, json=payload, cookies=self.cookies, headers=headers, verify=False)

            if r.status_code in [200, 204]:
                print(f"✅ PATCH ejecutado correctamente en SAP ({endpoint})")
                return True, "Documento actualizado correctamente"

            elif r.status_code == 301:
                print("⚠️ Sesión SAP expirada (PATCH). Reautenticando...")
                self.logged_in = False
                self.login()
                r = self.session.patch(url, json=payload, cookies=self.cookies, headers=headers, verify=False)
                if r.status_code in [200, 204]:
                    print("✅ PATCH reintentado correctamente.")
                    return True, "Documento actualizado"
                else:
                    print(f"❌ Error PATCH SAP: {r.text}")
                    return False, r.text
            else:
                print(f"❌ Error PATCH SAP: {r.text}")
                return False, r.text

        except Exception as e:
            print("❌ Error ejecutando PATCH:", e)
            return False, str(e)

    # === DELETE ===
    def delete(self, endpoint):
        self._ensure_session()
        try:
            url = f"{self.base_url}/{endpoint}"
            r = self.session.delete(url, cookies=self.cookies, verify=False)

            if r.status_code in [200, 204]:
                print(f"🗑️ Documento eliminado correctamente: {endpoint}")
                return True, "Documento eliminado"
            else:
                print(f"❌ Error DELETE SAP: {r.text}")
                return False, r.text

        except Exception as e:
            print("❌ Error DELETE SAP:", e)
            return False, str(e)


    def logout(self):
        """Finaliza la sesión actual en SAP Business One."""
        try:
            self.post("Logout", {})
            print("🔒 Sesión SAP cerrada correctamente.")
        except Exception as e:
            print(f"⚠️ No se pudo cerrar sesión SAP: {e}")


validacion_bp = Blueprint("validacion_bp", __name__)

@validacion_bp.route("/validar_docnum/<int:docnum>", methods=["GET"])
def validar_docnum(docnum):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM FACTURAS WHERE NUMERO_SOLICITUD_SAP = ?", (docnum,))
        existe = cursor.fetchone()[0] > 0
        cursor.close()
        conn.close()
        return jsonify({"existe": existe})
    except Exception as e:
        print(f"❌ Error al validar DocNum: {e}")
        return jsonify({"error": str(e)}), 500
