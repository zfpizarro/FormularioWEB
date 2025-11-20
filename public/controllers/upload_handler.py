import os
import json
import shutil
import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import openai

from controllers.validations import (
    registrar_log, leer_pdf, extract_json, es_factura_combustible
)
from controllers_sap.sap_service import SAPServiceLayer
from controllers_sap.sap_getters import (
    get_vendor_by_rut, get_item_by_description, get_warehouse_by_code
)

upload_bp = Blueprint("upload_bp", __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

OUTSTANDING_DIR = os.path.join(PUBLIC_DIR, "outstanding")
UPLOADS_DIR = os.path.join(PUBLIC_DIR, "uploads")

def detectar_rut_factura(pdf_text: str) -> str:
    import re
    rut_pattern = re.compile(r"(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])")
    ruts = rut_pattern.findall(pdf_text)
    if not ruts:
        return "PN00000000-0"
    rut = ruts[0].replace(".", "")
    return f"PN{rut}"


def detectar_almacen(pdf_text: str) -> str:
    texto = pdf_text.upper()
    if "QUEBRADA SAN ANTONIO" in texto or "SAN ANTONIO" in texto:
        return "BOD_SAN"
    if "AGUA GRANDE" in texto or "LAMBERT" in texto or "FAENA LAMBERT" in texto:
        return "BOD_LAM"
    if "MOLLE" in texto or "TALCUNA" in texto or "MARQUESA" in texto or "FAENA TALCUNA" in texto:
        return "BOD_TAL"


def obtener_ultima_solicitud_sap():

    try:
        sap = SAPServiceLayer()
        sap.login()
        ok, data = sap.get("PurchaseRequests?$orderby=DocNum desc&$top=1")
        sap.logout()

        if ok and data.get("value"):
            ultimo_docnum = int(data["value"][0].get("DocNum", 0))
            siguiente_docnum = ultimo_docnum + 1
            print(f" Ultima solicitud SAP: {ultimo_docnum} → Siguiente sugerido: {siguiente_docnum}")
            return str(siguiente_docnum)
        else:
            print("No se encontro ninguna solicitud en SAP, se usara 1.")
            return "1"
    except Exception as e:
        print(f"No se pudo obtener la ultima solicitud SAP: {e}")
        return "0"

@upload_bp.route("/upload_temp", methods=["POST"])
def upload_temp():

    try:
        if "file" not in request.files:
            return jsonify({"status": "error", "error": "No se recibio archivo"}), 400

        file = request.files["file"]
        if not file.filename:
            return jsonify({"status": "error", "error": "Archivo vacio"}), 400

        filename = secure_filename(file.filename)
        save_path = os.path.join(OUTSTANDING_DIR, filename)
        file.save(save_path)

        print(f"PDF guardado temporalmente en Outstanding: {save_path}")
        return jsonify({"status": "ok", "path": save_path}), 200

    except Exception as e:
        print(f"Error guardando PDF temporal: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500

@upload_bp.route("/upload", methods=["POST"])
def upload_file():
    """Procesa OCR, genera el JSON y lo mueve a Uploads."""
    print("[UPLOAD] Procesando OCR...")

    if "file" not in request.files:
        return jsonify({"error": "Falta archivo PDF"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Archivo vacio"}), 400

    filename = secure_filename(file.filename)
    temp_path = os.path.join(OUTSTANDING_DIR, filename)
    file.save(temp_path)
    print(f"Archivo temporal guardado en: {temp_path}")

    try:
        # === LEER PDF ===
        with open(temp_path, "rb") as f:
            pdf_bytes = f.read()
        ok_pdf, pdf_text = leer_pdf(pdf_bytes)
        if not ok_pdf:
            registrar_log(None, "RECHAZADO", pdf_text)
            return jsonify({"status": "rechazado", "mensaje": pdf_text}), 400

        # === DETECTAR DATOS BASE ===
        rut_proveedor = detectar_rut_factura(pdf_text)
        almacen = detectar_almacen(pdf_text)
        solicitud_sap_num = obtener_ultima_solicitud_sap() or "000"

        # === GPT OCR ===
        prompt = f"""
Extrae los datos de la siguiente factura y devuélvelos en formato JSON limpio para SAP B1:

{{
  "Factura": {{
    "Empresa del combustible": "...",
    "RUT_EMISOR": "...",
    "Número de factura": "...",
    "Número de guía": "...",
    "FECHA_EMISION": "...",
    "RUT_RECEPTOR": "...",
    "Nombre_Receptor": "...",
    "Direccion_Receptor": "...",
    "Despacho_Receptor": "...",
    "Detalle de productos": [
      {{
        "Nombre del producto": "...",
        "Cantidad (litros)": 0,
        "PBASE_SI_U": 0,
        "IEV U": 0,
        "IEF U": 0,
        "PTOTAL U": 0,
        "SUBTOTAL: 0
      }}
    ],
    "Detalle de Pago": {{
      "Subtotal": 0,
      "Base Afecta": 0,
      "FEEP": 0,
      "IEV": 0,
      "IEF": 0,
      "IVA": 0,
      "Total": 0
    }}
  }}
}}

SOLO responde con JSON válido, sin texto adicional.

Texto OCR:
{pdf_text}
"""
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Eres un OCR experto en facturas SAP Business One."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0
        )

        data = extract_json(response.choices[0].message.content)
        if not data or "Factura" not in data:
            raise ValueError("OCR sin estructura valida")

        factura = data["Factura"]
        detalle = factura.get("Detalle de productos", [{}])[0]
        desc_producto = detalle.get("Nombre del producto", "").upper()


        if not es_factura_combustible(data):
            registrar_log(None, "RECHAZADO", "Factura no corresponde a combustible")
            return jsonify({"status": "rechazado", "mensaje": "Factura no corresponde a combustible"}), 200

        # === DATOS SAP
        sap_vendor = get_vendor_by_rut(rut_proveedor.replace("PN", ""))
        sap_item = get_item_by_description(desc_producto)
        sap_whs = get_warehouse_by_code(almacen)

        def safe_utf8(val):
            if isinstance(val, str):
                return val.encode("latin1", "ignore").decode("utf-8", "ignore")
            return val

        proveedor_nombre = safe_utf8(sap_vendor["CardName"]) if sap_vendor else "—"
        proveedor_rut = safe_utf8(sap_vendor["CardCode"]) if sap_vendor else rut_proveedor
        item_code = sap_item["ItemCode"] if sap_item else "112080001"
        item_name = safe_utf8(sap_item["ItemName"]) if sap_item else desc_producto
        whs_name = safe_utf8(sap_whs["WarehouseName"]) if sap_whs else almacen

        litros_factura = float(detalle.get("Cantidad (litros)", 0) or 0)
        precio_unitario = float(detalle.get("PBASE_SI_U", 0))
        tax_code = "FUEL" if es_factura_combustible(data) else "FUEL"

        # === GUARDAR JSON TEMPORAL ===
        json_name = filename.replace(".pdf", ".json")
        json_path_temp = os.path.join(OUTSTANDING_DIR, json_name)
        with open(json_path_temp, "w", encoding="utf-8") as jf:
            json.dump(data, jf, indent=2, ensure_ascii=False)
        print(f"JSON OCR guardado en Outstanding: {json_path_temp}")

        # === MOVER JSON + PDF ===
        fecha_hoy = datetime.datetime.now().strftime("%Y%m%d")
        json_final_name = f"{solicitud_sap_num}_{fecha_hoy}_{json_name}"
        pdf_final_name = f"{solicitud_sap_num}_{fecha_hoy}_{filename}"

        destino_json = os.path.join(UPLOADS_DIR, json_final_name)
        destino_pdf = os.path.join(UPLOADS_DIR, pdf_final_name)

        try:
            shutil.move(json_path_temp, destino_json)
            print(f"JSON movido a Uploads → {destino_json}")
        except Exception as e:
            print(f"No se pudo mover JSON a Uploads: {e}")

        try:
            shutil.move(temp_path, destino_pdf)
            print(f" PDF movido a Uploads → {destino_pdf}")
        except Exception as e:
            print(f" No se pudo mover PDF a Uploads: {e}")

        # === RESPUESTA FINAL AL FRONT ===
        return jsonify({
            "status": "ok",
            "mensaje": "OCR procesado correctamente",
            "archivo_pdf": filename,
            "solicitud_sap": solicitud_sap_num,
            "litros": litros_factura,
            "precio_unitario": precio_unitario,
            "tax_code": tax_code,
            "item_code": item_code,
            "descripcion": item_name,
            "sap_vendor_name": proveedor_nombre,
            "sap_vendor_code": proveedor_rut,
            
            "sap_whs_name": whs_name,
            "ocr_data": data
        }), 200

    except Exception as e:
        print(f"❌ Error procesando PDF: {e}")
        registrar_log(None, "ERROR_UPLOAD", str(e))
        return jsonify({"error": str(e)}), 500
