import React, { useState, useEffect } from "react";
import { RefreshCcw, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../config/axiosInstance";


export default function Request_user_delete() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formMeta, setFormMeta] = useState({
    nombreSolicitante: "",
    gerencia: "",
    area: "",
    fecha: "",
    emailSolicitante: "", 
  });
  const [loading, setLoading] = useState(false);
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  // === 🔹 Autocompletar datos del solicitante desde localStorage ===
  useEffect(() => {
    const nombreSolicitante = localStorage.getItem("usuario") || "";
    const area = localStorage.getItem("usuario_area") || "";
    const gerencia = localStorage.getItem("usuario_gerencia") || "";
    const emailSolicitante = localStorage.getItem("usuario_email") || ""; 
    const fecha = new Date().toISOString().split("T")[0];

    setFormMeta({ nombreSolicitante, area, gerencia, fecha, emailSolicitante });
  }, []);

  // === 🔹 Cargar usuarios y filtrar según gerencia ===
  useEffect(() => {
    const usuarioGerencia = localStorage.getItem("usuario_gerencia");
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");

    api
      .get("/get_usuarios")
      .then((res) => {
        let data = res.data;

        // Si NO es ADMIN_TI → filtrar por gerencia
        if (!roles.includes("ADMIN_TI")) {
          data = data.filter((u) => u.GERENCIA === usuarioGerencia);
        }

        setUsers(data);
      })
      .catch((err) => console.error("❌ Error al cargar usuarios:", err));
  }, []);

  const handleChangeClick = (user) => {
    setSelectedUser({
      ...user,
      estado: user.ESTADO || "Activo",
      comentario: "",
    });
  };

  const handleChangeUser = (e) => {
    const { name, value } = e.target;
    setSelectedUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangeMeta = (e) => {
    const { name, value } = e.target;
    setFormMeta((prev) => ({ ...prev, [name]: value }));
  };

  // === 🔹 Enviar solicitud tipo 4 (Cambio de estado) ===
  const handleSave = async () => {
    if (!selectedUser || !formMeta.nombreSolicitante) {
      alert("Por favor complete los datos del solicitante y seleccione un usuario.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        id_usuario: selectedUser.ID_USUARIO,
        nuevo_estado: selectedUser.estado,
        comentario: selectedUser.comentario,
        nombreSolicitante: formMeta.nombreSolicitante,
        emailSolicitante: formMeta.emailSolicitante, 
        area: formMeta.area,
        gerencia: formMeta.gerencia,
        fecha: formMeta.fecha || new Date().toISOString().slice(0, 10),
      };

      console.log("📤 Enviando payload cambio de estado:", payload);

      const res = await api.post("/insert_solicitud_estado_usuario", payload);

      alert(res.data.message);
      setSelectedUser(null);
    } catch (err) {
      console.error("❌ Error al enviar solicitud de cambio de estado:", err);
      alert("Error al crear la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  // === 🔹 Lógica de Paginación y Búsqueda ===
  const filteredUsers = users.filter(user =>
    user.NOMBRE_COMPLETO?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.RUT?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.AREA?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleBack = () => {
    setSelectedUser(null);
  };

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
          <h1 className="titulo-principal">Solicitud de Cambio de Estado</h1>
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
          {/* === BARRA DE BÚSQUEDA === */}
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

          {/* === TABLA DE USUARIOS === */}
          <div className="tabla-usuarios-wrapper">
            <h2 style={{ marginBottom: "15px", color: "#2c3e50" }}>
              Seleccionar Usuario
            </h2>
            
            <div className="results-info">
              Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredUsers.length)} de {filteredUsers.length} usuarios
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
                        <td>
                          <span className="rol-tag">{u.ROL}</span>
                        </td>
                        <td>
                          <button 
                            className="icon-btn" 
                            onClick={() => handleChangeClick(u)}
                            title="Cambiar estado"
                          >
                            <RefreshCcw size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="empty-state">
                        No se encontraron usuarios
                      </td>
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
                    <ChevronLeft size={16} style={{ marginRight: "5px", display: "inline" }} />
                    Anterior
                  </button>
                  
                  <div className="page-numbers">
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      // Mostrar solo algunas páginas
                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNumber}
                            className={`page-number ${currentPage === pageNumber ? "active" : ""}`}
                            onClick={() => handlePageChange(pageNumber)}
                          >
                            {pageNumber}
                          </button>
                        );
                      } else if (
                        pageNumber === currentPage - 2 ||
                        pageNumber === currentPage + 2
                      ) {
                        return <span key={pageNumber}>...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                    <ChevronRight size={16} style={{ marginLeft: "5px", display: "inline" }} />
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
              Solicitud de Cambio de Estado

              
            </h2>

          


            <form onSubmit={(e) => e.preventDefault()}>
              <h3 style={{ color: "#FF8C00", marginBottom: "15px" }}>
                Verificación de Identidad
              </h3>

              
              <div className="grid-2">
                <div>
                  <label>Nombre Solicitante *</label>
                  <input
                    type="text"
                    name="nombreSolicitante"
                    value={formMeta.nombreSolicitante}
                    onChange={handleChangeMeta}
                    readOnly
                  />
                </div>
                <div>
                  <label>Gerencia</label>
                  <input
                    type="text"
                    name="gerencia"
                    value={formMeta.gerencia}
                    onChange={handleChangeMeta}
                    readOnly
                  />
                </div>
                <div>
                  <label>Fecha</label>
                  <input type="date" name="fecha" value={formMeta.fecha} readOnly />
                </div>
                <div>
                  <label>Área</label>
                  <input
                    type="text"
                    name="area"
                    value={formMeta.area}
                    onChange={handleChangeMeta}
                    readOnly
                  />
                </div>
                <div>
                  <label>Email</label>
                  <input
                    type="text"
                    name="emailSolicitante"
                    value={formMeta.emailSolicitante}
                    onChange={handleChangeMeta}
                    readOnly
                  />
                </div>
              </div>
              
              <hr style={{ margin: "25px 0", border: "none", borderTop: "2px solid #e2e8f0" }} />

              <h3 style={{ color: "#FF8C00", marginBottom: "15px" }}>
                Datos del Usuario
              </h3>
              <div className="grid-2">
                <div>
                  <label>Nombre</label>
                  <input type="text" value={selectedUser.NOMBRE_COMPLETO} disabled />
                </div>
                <div>
                  <label>RUT</label>
                  <input type="text" value={selectedUser.RUT} disabled />
                </div>
                <div>
                  <label>Área</label>
                  <input type="text" value={selectedUser.AREA} disabled />
                </div>
                <div>
                  <label>Cargo</label>
                  <input type="text" value={selectedUser.CARGO} disabled />
                </div>
              </div>
              
              <hr style={{ margin: "25px 0", border: "none", borderTop: "2px solid #e2e8f0" }} />

              <h3 style={{ color: "#FF8C00", marginBottom: "15px" }}>
                Cambio de Estado
              </h3>
              <div className="grid-2">
                <div>
                  <label>Nuevo Estado *</label>
                  <select name="estado" value={selectedUser.estado} onChange={handleChangeUser}>
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label>Comentario *</label>
                  <textarea
                    name="comentario"
                    value={selectedUser.comentario}
                    onChange={handleChangeUser}
                    placeholder="Ingrese motivo del cambio"
                    style={{ minHeight: "80px" }}
                  ></textarea>
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