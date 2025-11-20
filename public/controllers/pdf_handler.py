from flask import Blueprint, send_from_directory, jsonify
import os

pdfs_bp = Blueprint("pdfs_bp", __name__)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))      
PUBLIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "..")) 

OUTSTANDING_DIR = os.path.join(PUBLIC_DIR, "outstanding")
UPLOADS_DIR = os.path.join(PUBLIC_DIR, "uploads")

@pdfs_bp.route("/pdfs/<path:filename>")
def serve_pdf(filename):
    rutas = [UPLOADS_DIR, OUTSTANDING_DIR]

    numero = os.path.splitext(filename)[0].lower()
    candidatos = []

    for ruta in rutas:
        if not os.path.isdir(ruta):
            continue

        for archivo in os.listdir(ruta):
            if archivo.lower().endswith(".pdf") and numero in archivo.lower():
                full_path = os.path.join(ruta, archivo)
                candidatos.append((ruta, archivo, os.path.getmtime(full_path)))

    if not candidatos:
        print(f"No se encontró ningún archivo que contenga '{numero}' en {rutas}")
        return jsonify({"error": f"No se encontró PDF que coincida con '{numero}'"}), 404

    # Seleccionar el PDF más reciente encontrado
    candidatos.sort(key=lambda x: x[2], reverse=True)
    ruta_final, archivo_final, _ = candidatos[0]

    return send_from_directory(ruta_final, archivo_final)
