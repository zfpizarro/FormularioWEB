import React from "react";
import { Navigate } from "react-router-dom";


export default function ProtectedRoute({ requiredRoles = [], children }) {
  const token = localStorage.getItem("token");
  const roles = JSON.parse(localStorage.getItem("roles") || "[]");



  if (!token) {
    console.warn("🔒 No hay token, redirigiendo al login...");
    return <Navigate to="/login" replace />;
  }


  if (!roles || roles.length === 0) {
    console.warn("⚠️ Usuario sin roles asignados, redirigiendo al login...");
    return <Navigate to="/login" replace />;
  }

  const tienePermiso = roles.some((r) => requiredRoles.includes(r));

  if (!tienePermiso) {
    console.warn("🚫 Acceso denegado. Rol insuficiente.");
    return <Navigate to="/" replace />;
  }

  return children;
}
