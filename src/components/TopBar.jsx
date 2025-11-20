import React, { useState, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "../styles/topbar.css";

export default function TopBar() {
  const [openMenu, setOpenMenu] = useState(null);
  const timeoutRef = useRef(null);
  const navigate = useNavigate();
  const roles = JSON.parse(localStorage.getItem("roles") || "[]");
  const usuario = localStorage.getItem("usuario") || "Usuario";

  const handleMouseEnter = (menu) => {
    clearTimeout(timeoutRef.current);
    setOpenMenu(menu);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpenMenu(null), 200);
  };

  const handleLogout = () => {
    if (window.confirm("¿Deseas cerrar sesión?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("roles");
      localStorage.removeItem("usuario");
      navigate("/login");
    }
  };

  const tieneRol = (...rolList) => rolList.some((rol) => roles.includes(rol));


  return (
    <header className="topbar">
      <div className="topbar-left">
        <a href="https://cmsg.cl" target="_blank" rel="noreferrer">
          <img
            src="https://cmsg.cl/wp-content/uploads/2022/04/Logo_minera.svg"
            alt="CMSG Logo"
            className="topbar-logo"
          />
        </a>
      </div>

      <nav className="topbar-menu">
        {(tieneRol("COMPRAS") || tieneRol("BODEGA") || tieneRol("ADMIN_TI")) && (
          <div
            className="topbar-dropdown"
            onMouseEnter={() => handleMouseEnter("proceso")}
            onMouseLeave={handleMouseLeave}
          >
            <button className="topbar-link drop-btn">
              Proceso Combustible ▾
            </button>
            {openMenu === "proceso" && (
              <div
                className="dropdown-content"
                onMouseEnter={() => handleMouseEnter("proceso")}
              >
                <div className="dropdown-column">
                  <h4>Módulos del Proceso</h4>
                  <NavLink to="/fuel_request" className="dropdown-link">
                    Solicitud con Factura
                  </NavLink>
                  {tieneRol("COMPRAS", "ADMIN_TI") && (
                    <NavLink to="/dashboard_buyers" className="dropdown-link">
                      Orden de Compra
                    </NavLink>
                  )}
                  {tieneRol("BODEGA", "ADMIN_TI") && (
                    <NavLink to="/dashboard_goodsentry" className="dropdown-link">
                      Entrada de Mercancia
                    </NavLink>
                  )}
                  <NavLink
                    to="/dashboard_buyers_without_sap"
                    className="dropdown-link"
                  >
                    Historial de Solicitudes
                  </NavLink>
                  {tieneRol("ADMIN_TI") && (
                    <NavLink to="/Dashboard" className="dropdown-link">
                      Dashboard Administración
                    </NavLink>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {(tieneRol("SOLICITANTE") || tieneRol("ADMIN_TI")) && (
          <div
            className="topbar-dropdown"
            onMouseEnter={() => handleMouseEnter("admin_sap")}
            onMouseLeave={handleMouseLeave}
          >
            <button className="topbar-link drop-btn">Archivo Maestro ▾</button>
            {openMenu === "admin_sap" && (
              <div
                className="dropdown-content"
                onMouseEnter={() => handleMouseEnter("admin_sap")}
              >
                <div className="dropdown-column">
                  <h4> - </h4>
                  <NavLink to="/request_master" className="dropdown-link">
                    Solicitud Maestro de Productos
                  </NavLink>
                  <NavLink to="/request_items" className="dropdown-link">
                    Solicitud Maestro de Equipos
                  </NavLink>
                  <NavLink to="/request_sn" className="dropdown-link">
                    Solicitud Maestro de Socios de Negocio
                  </NavLink>
                  <NavLink to="/request_aj" className="dropdown-link">
                    Solicitud Maestro de Activos Fijos
                  </NavLink>
                  <NavLink to="/request_user_main" className="dropdown-link">
                    Solicitud Maestro Usuario SAP
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        )}

        {(tieneRol("FINANZAS") || tieneRol("ADMIN_TI")) && (
          <div
            className="topbar-dropdown"
            onMouseEnter={() => handleMouseEnter("req_dash")}
            onMouseLeave={handleMouseLeave}
          >
            <button className="topbar-link drop-btn">
              Solicitudes de Maestros ▾
            </button>
            {openMenu === "req_dash" && (
              <div
                className="dropdown-content"
                onMouseEnter={() => handleMouseEnter("req_dash")}
              >
                <div className="dropdown-column">
                  <h4> - </h4>
                  <NavLink to="/request_dashboard" className="dropdown-link">
                    Maestros
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        )}

        {tieneRol("ADMIN_TI") && (
          <div
            className="topbar-dropdown"
            onMouseEnter={() => handleMouseEnter("useradmin_dash")}
            onMouseLeave={handleMouseLeave}
          >
            <button className="topbar-link drop-btn">
              Administración de Solicitudes ▾
            </button>
            {openMenu === "useradmin_dash" && (
              <div
                className="dropdown-content"
                onMouseEnter={() => handleMouseEnter("useradmin_dash")}
              >
                <div className="dropdown-column">
                  <h4> - </h4>
                  <NavLink to="/request_user_dashboard" className="dropdown-link">
                    Solicitudes de Usuarios SAP
                  </NavLink>
                  <NavLink to="/request_user_dashboard" className="dropdown-link">
                    Usuarios SAP
                  </NavLink>
                  <NavLink to="/users_system" className="dropdown-link">
                    Usuarios del Sistema
                  </NavLink>
                  <NavLink to="/request_user_dashboard" className="dropdown-link">
                    Gestión de Roles
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="topbar-right">
        <span className="user-name">{usuario}</span>
        <button className="lang-btn" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
