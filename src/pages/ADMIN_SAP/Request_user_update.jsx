import React, { useState, useEffect } from "react";
import { Pencil, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../config/axiosInstance";
import "/src/styles/request_user.css";

export default function Request_user_update() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [loading, setLoading] = useState(false);

  // === META DEL SOLICITANTE ===
  const [formMeta, setFormMeta] = useState({
    nombreSolicitante: "",
    gerencia: "",
    area: "",
    fecha: "",
    emailSolicitante: "",
  });

  // === PAGINACIÓN & BUSCADOR ===
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const nombreSolicitante = localStorage.getItem("usuario") || "";
    const area = localStorage.getItem("usuario_area") || "";
    const gerencia = localStorage.getItem("usuario_gerencia") || "";
    const emailSolicitante = localStorage.getItem("usuario_email") || "";
    const fecha = new Date().toISOString().split("T")[0];

    setFormMeta({ nombreSolicitante, area, gerencia, fecha, emailSolicitante });
  }, []);

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const usuarioGerencia = localStorage.getItem("usuario_gerencia");
        const rolesStorage = JSON.parse(localStorage.getItem("roles") || "[]");

        const res = await api.get("/get_usuarios");
        let data = res.data;

        if (!rolesStorage.includes("ADMIN_TI")) {
          data = data.filter((u) => u.GERENCIA === usuarioGerencia);
        }

        setUsuarios(data);
      } catch (err) {
        console.error("❌ Error al cargar usuarios:", err);
      }
    };

    const cargarRoles = async () => {
      try {
        const res = await api.get("/get_roles");
        setRoles(res.data);
      } catch (err) {
        console.error("❌ Error al cargar roles:", err);
      }
    };

    cargarUsuarios();
    cargarRoles();
  }, []);

  const handleEditClick = (user) => {
    setSelectedUser({ ...user });
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setSelectedUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const payload = {
        id_usuario: selectedUser.ID_USUARIO,
        NOMBRE_COMPLETO: selectedUser.NOMBRE_COMPLETO,
        RUT: selectedUser.RUT,
        EMAIL: selectedUser.EMAIL,
        CARGO: selectedUser.CARGO,
        AREA_USUARIO: selectedUser.AREA,
        GERENCIA_USUARIO: selectedUser.GERENCIA,
        ROL: selectedUser.ROL,
        nombreSolicitante: formMeta.nombreSolicitante,
        area: formMeta.area,
        gerencia: formMeta.gerencia,
        fecha: formMeta.fecha,
        emailSolicitante: formMeta.emailSolicitante,
      };

      const res = await api.post("/insert_solicitud_modificacion_usuario", payload);

      alert(res.data.message);
      setSelectedUser(null);
    } catch (err) {
      console.error("❌ Error:", err);
      alert("Error al crear la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = usuarios.filter((u) =>
    u.NOMBRE_COMPLETO.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.RUT.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.AREA.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const handleBack = () => setSelectedUser(null);

  return (
    <div className="usuarios-container">
      <div className="dashboard-header-section">
        <div>
          <button 
            onClick={() => navigate('/request_user_main')} 
            className="btn-volver"
            style={{
              background: 'transparent',
              border: '2px solid #FF8C00',
              color: '#FF8C00',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#FF8C00';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#FF8C00';
            }}
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <h1 className="titulo-principal">Solicitud de Actualización de Usuario</h1>
        </div>
        <img
          src="https://acti.pe/wp-content/uploads/2024/08/SAP-B1.png"
          alt="SAP"
          className="topbar-logo"
          style={{ height: "50px" }}
        />
      </div>
      {!selectedUser ? (
        <>
          <div className="filter-card">
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Buscar por nombre, RUT o área..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <div className="tabla-usuarios-wrapper">
            <h2 style={{ marginBottom: "15px", color: "#2c3e50" }}>
              Seleccionar Usuario
            </h2>

            <div className="results-info">
              Mostrando {indexOfFirst + 1} -{" "}
              {Math.min(indexOfLast, filteredUsers.length)} de {filteredUsers.length} usuarios
            </div>

            <div className="tabla-usuarios-container">
              <table className="tabla-usuarios">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>RUT</th>
                    <th>Gerencia</th>
                    <th>Área</th>
                    <th>Rol</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.length > 0 ? (
                    currentUsers.map((u) => (
                      <tr key={u.ID_USUARIO}>
                        <td>{u.NOMBRE_COMPLETO}</td>
                        <td>{u.RUT}</td>
                        <td>{u.GERENCIA}</td>
                        <td>{u.AREA}</td>
                        <td><span className="rol-tag">{u.ROL}</span></td>
                        <td>
                          <button className="icon-btn" onClick={() => handleEditClick(u)}>
                            <Pencil size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-state">No se encontraron usuarios</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* === PAGINACIÓN === */}
            {totalPages > 1 && (
              <div className="table-pagination">
                <div className="table-pagination-info">
                  Página {currentPage} de {totalPages}
                </div>

                <div className="table-pagination-controls">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} style={{ marginRight: "5px" }} />
                    Anterior
                  </button>

                  <div className="page-numbers">
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            className={`page-number ${currentPage === pageNum ? "active" : ""}`}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                        return <span key={pageNum}>...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                    <ChevronRight size={16} style={{ marginLeft: "5px" }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>

          <div className="form-card">
            <h2 style={{ marginBottom: "20px", color: "#2c3e50" }}>
              Solicitud de Actualización de Usuario
            </h2>

            <form onSubmit={(e) => e.preventDefault()}>
              <h3 style={{ color: "#FF8C00", marginBottom: "15px" }}>
                Verificación de Identidad
              </h3>

              <div className="grid-2">
                <div>
                  <label>Nombre Solicitante</label>
                  <input type="text" value={formMeta.nombreSolicitante} readOnly />
                </div>
                <div>
                  <label>Gerencia</label>
                  <input type="text" value={formMeta.gerencia} readOnly />
                </div>
                <div>
                  <label>Fecha</label>
                  <input type="date" value={formMeta.fecha} readOnly />
                </div>
                <div>
                  <label>Área</label>
                  <input type="text" value={formMeta.area} readOnly />
                </div>
                <div>
                  <label>Email</label>
                  <input type="text" value={formMeta.emailSolicitante} readOnly />
                </div>
              </div>

              <hr style={{ margin: "25px 0", borderTop: "2px solid #e2e8f0" }} />

              <h3 style={{ color: "#FF8C00", marginBottom: "15px" }}>
                Datos del Usuario
              </h3>
              <div className="grid-2">
                <div>
                  <label>Nombre Completo</label>
                  <input type="text" value={selectedUser.NOMBRE_COMPLETO} readOnly />
                </div>
                <div>
                  <label>RUT</label>
                  <input type="text" value={selectedUser.RUT} readOnly />
                </div>
                <div>
                  <label>Área</label>
                  <input type="text" value={selectedUser.AREA} readOnly />
                </div>
                <div>
                  <label>Cargo</label>
                  <input type="text" value={selectedUser.CARGO} readOnly />
                </div>
                <div>
                  <label>Gerencia</label>
                  <input type="text" value={selectedUser.GERENCIA} readOnly />
                </div>
                <div>
                  <label>Rol</label>
                  <select name="ROL" value={selectedUser.ROL} onChange={handleUserChange}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.nombre}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="button-container" style={{ marginTop: "25px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleBack}
                  style={{ marginRight: "10px" }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={loading}
                  onClick={handleSave}
                >
                  {loading ? "Enviando..." : "Enviar Solicitud"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}