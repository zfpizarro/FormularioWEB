import io
import json
import datetime
import PyPDF2
from bd import get_connection

# === PARSEAR FECHA (dd-MMM-yyyy) ===
def parse_fecha(fecha_str):
    if not fecha_str:
        return None
    meses = {"ENE":1,"FEB":2,"MAR":3,"ABR":4,"MAY":5,"JUN":6,
             "JUL":7,"AGO":8,"SEP":9,"OCT":10,"NOV":11,"DIC":12}
    try:
        d, m, a = fecha_str.strip().split("-")
        return datetime.date(int(a), meses[m.upper()], int(d))
    except Exception as e:
        registrar_log(None, "ERROR", f"Error parseando fecha: {fecha_str} → {e}")
        return None


# === NORMALIZAR STRINGS (acentos, mayúsculas) ===
def _normalize(s: str) -> str:
    if not s:
        return ""
    s = s.upper().strip()
    return (s.replace("Á","A").replace("É","E").replace("Í","I")
             .replace("Ó","O").replace("Ú","U").replace("Ñ","N"))


# === EXTRAER JSON DE TEXTO OCR ===
def extract_json(texto: str):
    try:
        return json.loads(texto)
    except Exception:
        pass
    try:
        start = texto.find("{")
        end = texto.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(texto[start:end+1])
    except Exception as e:
        registrar_log(None, "ERROR", f"No se pudo extraer JSON: {e}")
    return None


# === DETECTAR FACTURA DE COMBUSTIBLE ===
def es_factura_combustible(data: dict) -> bool:
    if not data or "Factura" not in data:
        registrar_log(None, "ADVERTENCIA", "Payload OCR sin campo 'Factura'")
        return False

    factura = data["Factura"]
    texto = json.dumps(factura, ensure_ascii=False).upper()

    keywords_combustible = [
        "PETROLEO DIESEL", "DIESEL", "PETROLEO", "COMBUSTIBLE",
        "BENCINA", "FUEL", "ACEITE DIESEL", "COPEC",
        "CARGA DE COMBUSTIBLE", "VENTA COMBUSTIBLE"
    ]
    keywords_no_combustible = [
        "MOBIL", "LUBRICANTE", "ACEITE HIDRÁULICO", "GRASA",
        "ULTRA", "DTE", "TAMBOR", "LUB"
    ]

    tiene_combustible = any(k in texto for k in keywords_combustible)
    tiene_no_combustible = any(k in texto for k in keywords_no_combustible)

    if tiene_combustible and not tiene_no_combustible:
        registrar_log(None, "VALIDACION", "Factura identificada como de combustible")
        return True

    registrar_log(None, "ADVERTENCIA", "Factura no corresponde a combustible")
    return False


# === REGISTRAR LOG ===
def registrar_log(id_factura, estado, comentario):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        fecha = datetime.date.today()
        hora = datetime.datetime.now().time().strftime("%H:%M:%S")

        cursor.execute("""
            INSERT INTO LOGS (ID_FACTURA, FECHA, HORA, ESTADO, COMENTARIO)
            VALUES (?, ?, ?, ?, ?)
        """, (id_factura, fecha, hora, estado, comentario))

        conn.commit()
        conn.close()
        print(f"🧾 Log registrado → Estado: {estado} | {comentario}")
    except Exception as e:
        print(f"⚠️ Error al registrar log: {e}")


# === VALIDAR SI LA SOLICITUD SAP ESTÁ DUPLICADA ===
def validar_solicitud_duplicada(solicitud_sap: str) -> bool:
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM FACTURAS WHERE NUMERO_SOLICITUD_SAP = ?", solicitud_sap)
        duplicated = cur.fetchone()[0] > 0
        conn.close()
        if duplicated:
            registrar_log(None, "ERROR", f"Solicitud SAP duplicada: {solicitud_sap}")
        return duplicated
    except Exception as e:
        registrar_log(None, "ERROR", f"Error validando duplicado SAP: {e}")
        return False


# === VALIDAR DISTRIBUCIÓN DE ESTANQUES ===
def validar_estanques(distribuciones):
    conn = get_connection()
    cur = conn.cursor()
    for dist in distribuciones:
        try:
            cur.execute("SELECT CAPACIDAD_LITROS FROM ESTANQUES WHERE ID_ESTANQUE = ?", dist["tank"])
            row = cur.fetchone()
            if not row:
                registrar_log(None, "ERROR", f"Estanque {dist['tank']} no existe")
                conn.close()
                return False, f"Estanque {dist['tank']} no existe"

            capacidad = row[0]
            if dist["liters"] > capacidad:
                registrar_log(None, "ERROR", f"Distribución excede capacidad del estanque {dist['tank']} (máx {capacidad})")
                conn.close()
                return False, f"Distribución excede capacidad del estanque {dist['tank']} (máx {capacidad})"
        except Exception as e:
            registrar_log(None, "ERROR", f"Error validando estanque {dist.get('tank')}: {e}")
            conn.close()
            return False, f"Error en validación de estanque {dist.get('tank')}"
    conn.close()
    registrar_log(None, "VALIDACION", "Distribución de estanques validada correctamente")
    return True, ""


# === LEER CONTENIDO DE UN PDF ===
def leer_pdf(pdf_bytes: bytes):
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        pdf_text = "".join(page.extract_text() or "" for page in reader.pages)
        registrar_log(None, "LECTURA", "PDF leído correctamente")
        return True, pdf_text
    except Exception as e:
        registrar_log(None, "ERROR", f"Error leyendo PDF: {e}")
        return False, "Archivo no es PDF válido"


# === CALCULAR LITROS TOTALES DE UNA FACTURA ===
def litros_totales_factura(factura: dict) -> float:
    total = 0.0
    try:
        for det in (factura.get("Detalle de productos") or []):
            cantidad = det.get("Cantidad (litros)", 0)
            if isinstance(cantidad, str):
                cantidad = cantidad.replace(",", "").strip()
                cantidad = float(cantidad) if cantidad.replace(".", "", 1).isdigit() else 0
            total += float(cantidad)
        registrar_log(None, "VALIDACION", f"Litros totales calculados: {total}")
    except Exception as e:
        registrar_log(None, "ERROR", f"Error al calcular litros totales: {e}")
    return total


# === FORMATO PESO CL ===
def formato_peso_chileno(valor) -> str:
    if valor is None:
        return ""
    try:
        return f"{int(round(float(valor))):,}".replace(",", ".")
    except Exception:
        return str(valor)
