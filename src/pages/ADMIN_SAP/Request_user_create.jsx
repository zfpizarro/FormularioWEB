import React, { useState, useEffect } from "react";
import "/src/styles/request_master.css";
import { useNavigate } from "react-router-dom";
import api from "../../config/axiosInstance";
import BASE_URL from "../../config/apiConfig";

export default function Request_user_create() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    nombreSolicitante: "",
    gerencia: "",
    area: "",
    fecha: "",
    emailSolicitante: "", 
    nombreCompleto: "",
    rut: "",
    email: "",
    cargo: "",
    rol: "",
    areaUsuario: "",
    gerenciaUsuario: "",
    nombreUsuario: "",
  });


  useEffect(() => {
    // === FECHA AUTOMÁTICA ===
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];
    setFormData((prev) => ({ ...prev, fecha: formattedDate }));

    // === AUTOCOMPLETAR DATOS DEL SOLICITANTE ===
    const nombreSolicitante = localStorage.getItem("usuario") || "";
    const gerencia = localStorage.getItem("usuario_gerencia") || "";
    const area = localStorage.getItem("usuario_area") || "";
    const emailSolicitante = localStorage.getItem("email_solicitante") || "";


    setFormData((prev) => ({
      ...prev,
      nombreSolicitante,
      gerencia,
      area,
      emailSolicitante, 
    }));


    // === CARGAR ROLES ===
    api
      .get("/get_roles")
      .then((res) => setRoles(res.data))
      .catch((err) => console.error("❌ Error al cargar roles:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "nombreCompleto" && value.trim().split(" ").length >= 2) {
      generarNombreUsuario(value);
    }
  };

  const generarNombreUsuario = async (nombreCompleto) => {
    try {
      const res = await api.post("/generate_username", {
        nombreCompleto,
      });
      if (res.data.username) {
        setFormData((prev) => ({ ...prev, nombreUsuario: res.data.username }));
      }
    } catch (err) {
      console.error("⚠️ Error generando nombre de usuario:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombreSolicitante || !formData.nombreCompleto) {
      alert("Por favor complete los campos obligatorios.");
      return;
    }

    try {
      const res = await api.post(
        "/insert_solicitud_usuario",
        formData
      );
      alert(`✅ ${res.data.message}\nN° Solicitud: ${res.data.correlativo}`);
      navigate("/request_user_main");
    } catch (err) {
      console.error("❌ Error al enviar solicitud:", err);
      alert("Error al enviar la solicitud.");
    }
  };

  return (
    <div className="solicitud-container">
      <h1 className="titulo-principal">
        Solicitud de Creación de Usuario&nbsp;
        <img
          src="https://acti.pe/wp-content/uploads/2024/08/SAP-B1.png"
          alt="SAP Business One"
          className="topbar-logo"
        />
      </h1>

      <div className="solicitud-card">
        <form onSubmit={handleSubmit}>
          {/* === INFORMACIÓN DEL SOLICITANTE === */}
          <section>
            <h2>Información del Solicitante</h2>
            <div className="grid-2">
              <div>
                <label>Nombre Solicitante</label>
                <input
                  type="text"
                  name="nombreSolicitante"
                  value={formData.nombreSolicitante}
                  readOnly
                />
              </div>

              <div>
                <label>Gerencia</label>
                <input
                  type="text"
                  name="gerencia"
                  value={formData.gerencia}
                  readOnly
                />
              </div>

              <div>
                <label>Área</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  readOnly
                />
              </div>

              <div>
                <label>Fecha</label>
                <input type="date" name="fecha" value={formData.fecha} readOnly />
              </div>

              <div>
                <label>Email</label>
                <input
                  type="email"
                  name="emailSolicitante"
                  value={formData.emailSolicitante}
                  readOnly
                />
              </div>            
            </div>           
          </section>
          <hr />

          <section>
            <h2>Datos del Usuario a Crear</h2>
            <div className="grid-2">
              <div>
                <label>RUT</label>
                <input
                  type="text"
                  name="rut"
                  value={formData.rut}
                  placeholder="Ej: 18.123.456-7"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Nombre Completo</label>
                <input
                  type="text"
                  name="nombreCompleto"
                  value={formData.nombreCompleto}
                  placeholder="Ej: Diego Escamilla"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  placeholder="Ej: usuario@CMSG.CL"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Cargo</label>
                <input
                  type="text"
                  name="cargo"
                  value={formData.cargo}
                  placeholder="Ej: Operador de Planta"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Área Usuario</label>
                <input
                  type="text"
                  name="areaUsuario"
                  value={formData.areaUsuario}
                  placeholder="Ej: Operaciones"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Gerencia Usuario</label>
                <input
                  type="text"
                  name="gerenciaUsuario"
                  value={formData.gerenciaUsuario}
                  placeholder="Ej: Gerencia de Operaciones"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Rol</label>
                <select
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
                >
                  <option value="">Seleccione un rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.nombre}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Nombre Usuario</label>
                <input
                  type="text"
                  name="nombreUsuario"
                  value={formData.nombreUsuario}
                  readOnly
                  placeholder="Se genera automáticamente"
                />
              </div>
            </div>
          </section>

          <hr />

          <div className="button-container">
            <button type="submit">Enviar Solicitud</button>
            <button
              type="button"
              onClick={() => navigate("/request_user_main")}
              className="btn-cancel"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
