import React from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/user-requests.css";

export default function Request_user_main() {
  const navigate = useNavigate();

  const handleRedirect = (path) => {
    navigate(path);
  };

  return (
    <div className="user-requests-container">
      <div className="user-requests-card">
        <div className="user-requests-header">
          <h1 className="user-requests-title">Solicitudes de Usuario</h1>
          <img
            src="https://acti.pe/wp-content/uploads/2024/08/SAP-B1.png"
            alt="SAP Business One"
            className="sap-logo"
          />
        </div>

        <p className="user-requests-subtitle">
          Selecciona el tipo de solicitud que deseas realizar. Todas las
          solicitudes serán revisadas y aprobadas por el equipo correspondiente.
        </p>

        <div className="user-requests-options">
          <div className="user-request-option">
            <div className="user-request-icon create">
              <img src="/src/assets/imgs/create-user.png" alt="Crear Usuario" />
            </div>
            <h3 className="user-request-title">Crear Usuario</h3>
            <p className="user-request-desc">
              Solicitar la creación de un nuevo usuario en el sistema.
            </p>
            <button
              onClick={() => handleRedirect("/request_user_create")}
              className="user-request-btn"
            >
              Iniciar Solicitud
            </button>
          </div>

          <div className="user-request-option">
            <div className="user-request-icon state">
              <img src="/src/assets/imgs/edit-rol.png" alt="Editar Roles" />
              
            </div>
            <h3 className="user-request-title">Cambiar Estado de Usuario</h3>
            <p className="user-request-desc">
              Solicitar cambio de estado: activo, inactivo o deshabilitado.
            </p>
            <button
              onClick={() => handleRedirect("/request_user_delete")}
              className="user-request-btn"
            >
              Iniciar Solicitud
            </button>
          </div>

          <div className="user-request-option">
            <div className="user-request-icon roles">
              <img src="/src/assets/imgs/edit-user.png" alt="Cambiar Estado" />
            </div>
            <h3 className="user-request-title">Editar Roles de Usuario</h3>
            <p className="user-request-desc">
              Solicitar modificación de roles y permisos de un usuario.
            </p>
            <button
              onClick={() => handleRedirect("/request_user_update")}
              className="user-request-btn"
            >
              Iniciar Solicitud
            </button>
          </div>
        </div>
      </div>     
    </div>
    
  );
}
