import datetime
import os
import openai
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from bd import get_connection
from flask_jwt_extended import JWTManager
openai.api_key = os.getenv("OPENAI_API_KEY")
from controllers.auth_controller import auth_bp

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTSTANDING_FOLDER = os.path.join(BASE_DIR, "outstanding")
RESULTS_FOLDER = os.path.join(BASE_DIR, "results")
UPLOAD_COTIZACION_FOLDER = os.path.join(BASE_DIR, "uploads_cotizacion")

for folder in [UPLOAD_FOLDER, OUTSTANDING_FOLDER, RESULTS_FOLDER, UPLOAD_COTIZACION_FOLDER]:
    os.makedirs(folder, exist_ok=True)

def create_app():
    app = Flask(__name__)
    CORS(app)

    app.config["JWT_SECRET_KEY"] = "JM4W5PHFK990"  
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(hours=4)
    jwt = JWTManager(app)

    # Carpetas base
    app.config["BASE_DIR"] = BASE_DIR
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.config["OUTSTANDING_FOLDER"] = OUTSTANDING_FOLDER
    app.config["RESULTS_FOLDER"] = RESULTS_FOLDER
    app.config["UPLOAD_COTIZACION_FOLDER"] = UPLOAD_COTIZACION_FOLDER

    from controllers.upload_handler import upload_bp
    from controllers.insert_handler import insert_bp
    from controllers.data_getters import data_bp
    from controllers_maestros.insert_solicitud_producto import insert_solicitud_producto_bp  
    from controllers_maestros.get_solicitudes_maestro import get_solicitudes_maestro_bp
    from controllers_maestros.update_solicitud_maestro import update_solicitud_maestro_bp
    from controllers_sap.sap_getters import sap_getters_bp
    from controllers_sap.sap_handler import sap_bp
    from controllers_sap.sap_open_docs import sap_open_docs_bp
    from controllers_sap.sap_service import validacion_bp
    from controllers_sap.sap_convert import sap_convert_bp
    from controllers_sap.sap_handler import actualizar_codigos_ocr
    from controllers_user.user_solicitud import request_user_bp
    from controllers_sap.sap_actions import sap_actions_bp
    from controllers.pdf_handler import pdfs_bp
    from controllers.auth_controller import auth_bp
    from controllers.users_controller import users_bp
    
    app.register_blueprint(users_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(pdfs_bp)
    app.register_blueprint(request_user_bp)
    app.register_blueprint(sap_open_docs_bp)
    app.register_blueprint(sap_bp)
    app.register_blueprint(sap_getters_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(insert_bp)
    app.register_blueprint(data_bp)
    app.register_blueprint(insert_solicitud_producto_bp)  
    app.register_blueprint(get_solicitudes_maestro_bp)
    app.register_blueprint(update_solicitud_maestro_bp)
    app.register_blueprint(sap_actions_bp)
    app.register_blueprint(validacion_bp)
    app.register_blueprint(sap_convert_bp)
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=4003)

