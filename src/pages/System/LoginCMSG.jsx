import React, { useState } from "react";
import axios from "axios";
import "../../styles/login.css";
import api from "../../config/axiosInstance";

export default function LoginCMSG() {
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/login", { rut, password });


      if (res.data.status === "ok") {
        console.log("✅ Datos recibidos del backend:", res.data);

        // === Guardar datos del usuario ===
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("roles", JSON.stringify(res.data.roles));
        localStorage.setItem("usuario", res.data.usuario);
        localStorage.setItem("usuario_area", res.data.area || "");
        localStorage.setItem("usuario_gerencia", res.data.gerencia || "");
        localStorage.setItem("email_solicitante", res.data.email);
        localStorage.setItem("estanques_asignados", JSON.stringify(res.data.estanques || []));

        // === Determinar redirección por rol ===
        const roles = res.data.roles.map((r) => r.toUpperCase());

        if (roles.includes("ADMIN_TI")) {
          window.location.href = "/dashboard";
        } else if (roles.includes("COMPRAS")) {
          window.location.href = "/dashboard_buyers";
        } else if (roles.includes("BODEGA")) {
          window.location.href = "/fuel_request";
        } else if (roles.includes("SOLICITANTE")) {
          window.location.href = "/request_user_main";
        } else {
          // Si no tiene ningún rol reconocido
          window.location.href = "/";
        }
      } else {
        setError("Credenciales inválidas");
      }
    } catch (err) {
      console.error("❌ Error en el login:", err);
      setError("Credenciales incorrectas o usuario no válido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-image"></div>
        <div className="login-form">
          <h1>Bienvenidos</h1>
          <h2>Sistema Optimizador de Procesos en SAP</h2>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="RUT Usuario"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <br />
          {error && <p className="error-text">{error}</p>}

          <a href="https://cmsg.cl" target="_blank" rel="noreferrer">
            <img
              src="https://cmsg.cl/wp-content/uploads/2022/04/Logo_minera.svg"
              alt="CMSG Logo"
              className="topbar-logo"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
