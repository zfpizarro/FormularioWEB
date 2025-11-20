import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";
import "../../styles/request_dashboard.css";
import api from "../../config/axiosInstance";


export default function Request_dashboard_user() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);


  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");


  const [usuarios, setUsuarios] = useState([]);
  const [showUsuarios, setShowUsuarios] = useState(false);
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const elementosPorPagina = 6;

  const totalPaginas = Math.ceil(filtered.length / elementosPorPagina);

  const solicitudesPagina = filtered.slice(
    (paginaSolicitudes - 1) * elementosPorPagina,
    paginaSolicitudes * elementosPorPagina
);


  // === Función para parsear fecha en formato DD/MM/YYYY ===
  const parseFecha = (fechaStr) => {
    if (!fechaStr) return new Date(0);
    const [dia, mes, año] = fechaStr.split("/");
    return new Date(`${año}-${mes}-${dia}`);
  };

  // === Cargar solicitudes ===
  useEffect(() => {
    const fetchSolicitudes = async () => {
      try {
        const res = await api.get("/get_solicitudes_usuario");

        
        // Ordenar por estado (PENDIENTE primero) y luego por fecha
        const ordenadas = res.data.sort((a, b) => {
          // Si los estados son diferentes, priorizar PENDIENTE
          if (a.ESTADO_SOLICITUD === "PENDIENTE" && b.ESTADO_SOLICITUD !== "PENDIENTE") {
            return -1;
          }
          if (a.ESTADO_SOLICITUD !== "PENDIENTE" && b.ESTADO_SOLICITUD === "PENDIENTE") {
            return 1;
          }
          
          // Si ambos tienen el mismo estado, ordenar por fecha (más antigua primero)
          return parseFecha(a.FECHA_SOLICITUD) - parseFecha(b.FECHA_SOLICITUD);
        });
        
        setSolicitudes(ordenadas);
        setFiltered(ordenadas);
      } catch (err) {
        console.error("❌ Error al obtener solicitudes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSolicitudes();
  }, []);


  // === Aplicar filtros dinámicos ===
  useEffect(() => {
    let data = [...solicitudes];


    if (estadoFiltro !== "todos") {
      data = data.filter((s) => s.ESTADO_SOLICITUD === estadoFiltro);
    }


    if (tipoFiltro !== "todos") {
      data = data.filter((s) => s.TIPO_SOLICITUD.includes(tipoFiltro));
    }


    if (search.trim() !== "") {
      const term = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.NOMBRE_SOLICITANTE.toLowerCase().includes(term) ||
          s.NOMBRE_COMPLETO.toLowerCase().includes(term) ||
          s.NUMERO_SOLICITUD.toLowerCase().includes(term)
      );
    }


    if (fechaDesde) {
      data = data.filter((s) => parseFecha(s.FECHA_SOLICITUD) >= new Date(fechaDesde));
    }
    
    if (fechaHasta) {
      data = data.filter((s) => parseFecha(s.FECHA_SOLICITUD) <= new Date(fechaHasta));
    }


    // Ordenar: PENDIENTES primero, luego por fecha
    data.sort((a, b) => {
      if (a.ESTADO_SOLICITUD === "PENDIENTE" && b.ESTADO_SOLICITUD !== "PENDIENTE") {
        return -1;
      }
      if (a.ESTADO_SOLICITUD !== "PENDIENTE" && b.ESTADO_SOLICITUD === "PENDIENTE") {
        return 1;
      }
      return parseFecha(a.FECHA_SOLICITUD) - parseFecha(b.FECHA_SOLICITUD);
    });


    setFiltered(data);
    setPaginaSolicitudes(1); // Resetear a la primera página cuando cambian los filtros
  }, [estadoFiltro, tipoFiltro, search, fechaDesde, fechaHasta, solicitudes]);


  // === Estadísticas ===
  const stats = useMemo(() => {
    return {
      total: solicitudes.length,
      pendientes: solicitudes.filter((s) => s.ESTADO_SOLICITUD === "PENDIENTE").length,
      aprobadas: solicitudes.filter((s) => s.ESTADO_SOLICITUD === "APROBADO").length,
      rechazadas: solicitudes.filter((s) => s.ESTADO_SOLICITUD === "RECHAZADO").length,
    };
  }, [solicitudes]);


  const handleAction = async (id, accion) => {
    if (accion === "RECHAZADO" && !comment.trim()) {
      alert("Debe ingresar un comentario para rechazar la solicitud.");
      return;
    }


    try {
      const res = await api.put("/update_solicitud_usuario", {
        id_solicitud: id,
        accion,
        comentario: comment,
        aprobado_por: localStorage.getItem("usuario"),
        emailSolicitante: localStorage.getItem("email_solicitante"),
      });

      alert(res.data.message);
      setSolicitudes((prev) =>
        prev.map((s) =>
          s.ID_SOLICITUD === id ? { ...s, ESTADO_SOLICITUD: accion } : s
        )
      );
      
      setSelected(null);
      setComment("");
    } catch (err) {
      console.error("❌ Error al actualizar solicitud:", err);
      alert("Error al procesar la solicitud. Intente nuevamente.");
    }
  };

  const handlePageChange = (pageNumber) => {
    setPaginaSolicitudes(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // === Renderizado según tipo ===
  const renderBody = (s) => {
    switch (s.TIPO_SOLICITUD) {
      case "Creación de Usuario":
        return (
          <>
            <p><b>Usuario a Crear:</b> {s.NOMBRE_COMPLETO}</p>
            <p><b>RUT:</b> {s.RUT || "No especificado"}</p>
            <p><b>Cargo:</b> {s.CARGO || "No especificado"}</p>
            <p className="rol-line">
              <b>Rol Propuesto: </b>
              <span className="rol-text">{s.ROL_PROPUESTO || "No definido"}</span>
            </p>
          </>
        );


      case "Modificación de Usuario":
        return (
          <>
            <p><b>Usuario a Modificar:</b> {s.NOMBRE_COMPLETO}</p>
            <p><b>RUT:</b> {s.RUT || "No especificado"}</p>
            <div className="rol-cambio-container">
              <b>Cambio de Rol:</b>
              <div className="rol-cambio-visual">
                <span className="rol-actual">{s.ROL_ACTUAL || "Sin rol"}</span>
                <span className="rol-arrow">→</span>
                <span className="rol-nuevo">{s.ROL_PROPUESTO || "Sin rol"}</span>
              </div>
            </div>
          </>
        );


      case "Cambio de Estado de Usuario":
        return (
          <>
            <p><b>Usuario:</b> {s.NOMBRE_COMPLETO}</p>
            <p><b>RUT:</b> {s.RUT || "No especificado"}</p>
            <p className="rol-line">
              <b>Rol Actual: </b>
              <span className="rol-text">{s.ROL_ACTUAL || "No definido"}</span>
            </p>
            <p><b>Acción:</b> {s.ACCION_ESTADO || "Cambio de estado"}</p>
          </>
        );


      default:
        return <p>Sin detalles específicos</p>;
    }
  };


  return (
    <div className="request-user-dashboard-container">
      <div className="dashboard-header-section">
        <div>
          <h2 className="request-user-dashboard-title">Panel de Aprobaciones</h2>
          <p className="request-user-dashboard-subtitle">
            Revise, apruebe o rechace las solicitudes enviadas por los usuarios.
          </p>
        </div>


        {/* === BOTÓN VER USUARIOS === */}
        <button
          className="btn-ver-usuarios"
          onClick={async () => {
            try {
              const res = await api.get("/get_usuarios");
              setUsuarios(res.data);
              setShowUsuarios(true);
            } catch (err) {
              console.error("❌ Error al obtener usuarios:", err);
              alert("Error al obtener usuarios desde la base de datos.");
            }
          }}
        >
          Ver Usuarios Registrados
        </button>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{stats.pendientes}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-number">{stats.aprobadas}</div>
          <div className="stat-label">Aprobadas</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-number">{stats.rechazadas}</div>
          <div className="stat-label">Rechazadas</div>
        </div>
      </div>

      <div className="filter-card">
        <h3>Filtrar Solicitudes</h3>
        <div className="filter-grid">
          <input
            type="text"
            placeholder="Buscar por nombre o número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADO">Aprobado</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="Creación">Creación de Usuario</option>
            <option value="Modificación">Modificación de Usuario</option>
            <option value="Estado">Cambio de Estado</option>
          </select>
          <div className="date-filters">
            <label>Desde:</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            <label>Hasta:</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando solicitudes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>📭 No se encontraron solicitudes con esos filtros.</p>
        </div>
      ) : (
        <>
          <div className="results-info">
            <p>Mostrando {((paginaSolicitudes - 1) * elementosPorPagina) + 1} - {Math.min(paginaSolicitudes * elementosPorPagina, filtered.length)} de {filtered.length} solicitud{filtered.length !== 1 ? 'es' : ''}</p>
          </div>
          <div className="request-user-cards-grid">
            {solicitudesPagina.map((s) => (
              <div
                key={s.ID_SOLICITUD}
                className={`request-user-card ${
                  s.ESTADO_SOLICITUD === "APROBADO"
                    ? "approved"
                    : s.ESTADO_SOLICITUD === "RECHAZADO"
                    ? "rejected"
                    : "pending"
                }`}
              >
                <div className="request-user-card-header">
                  <span className="request-user-id">
                    Nº <b>{s.NUMERO_SOLICITUD}</b>
                  </span>
                  <span
                    className={`request-user-status ${
                      s.ESTADO_SOLICITUD === "APROBADO"
                        ? "status-approved"
                        : s.ESTADO_SOLICITUD === "RECHAZADO"
                        ? "status-rejected"
                        : "status-pending"
                    }`}
                  >
                    {s.ESTADO_SOLICITUD}
                  </span>
                </div>
                <div className="request-user-card-body">
                  <div
                    className={`tipo-solicitud-badge ${
                      s.TIPO_SOLICITUD.includes("Creación")
                        ? "badge-creacion"
                        : s.TIPO_SOLICITUD.includes("Modificación")
                        ? "badge-modificacion"
                        : "badge-estado"
                    }`}
                  >
                    {s.TIPO_SOLICITUD}
                  </div>
                  <p><b>Solicitante:</b> {s.NOMBRE_SOLICITANTE}</p>
                  <p><b>Área:</b> {s.AREA}</p>
                  <p><b>Gerencia:</b> {s.GERENCIA}</p>
                  <hr />
                  {renderBody(s)}
                  <p><b>Fecha:</b> {s.FECHA_SOLICITUD}</p>
                </div>
                <div className="request-user-card-footer">
                  <button className="btn-detail" onClick={() => setSelected(s)}>
                    Ver Detalle
                  </button>

                </div>

                
              </div>
            ))}
          </div>

          {/* === PAGINACIÓN === */}
          {totalPaginas > 1 && (
            <div className="table-pagination">
              <div className="table-pagination-info">
                Página {paginaSolicitudes} de {totalPaginas}
              </div>

              <div className="table-pagination-controls">
                <button
                  onClick={() => handlePageChange(paginaSolicitudes - 1)}
                  disabled={paginaSolicitudes === 1}
                >
                  <ChevronLeft size={16} style={{ marginRight: "5px" }} />
                  Anterior
                </button>

                <div className="page-numbers">
                  {[...Array(totalPaginas)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPaginas ||
                      (pageNum >= paginaSolicitudes - 1 && pageNum <= paginaSolicitudes + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          className={`page-number ${paginaSolicitudes === pageNum ? "active" : ""}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === paginaSolicitudes - 2 || pageNum === paginaSolicitudes + 2) {
                      return <span key={pageNum}>...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(paginaSolicitudes + 1)}
                  disabled={paginaSolicitudes === totalPaginas}
                >
                  Siguiente
                  <ChevronRight size={16} style={{ marginLeft: "5px" }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}


      {/* === MODAL USUARIOS === */}
      {showUsuarios && (
        <div
          className="request-user-modal"
          onClick={(e) => {
            if (e.target.classList.contains("request-user-modal")) {
              setShowUsuarios(false);
            }
          }}
        >
          <div className="request-user-modal-content large">
            <button
              className="request-user-modal-close"
              onClick={() => setShowUsuarios(false)}
            >
              ✖
            </button>
            <h3>👥 Usuarios Registrados en el Sistema</h3>
            {usuarios.length === 0 ? (
              <p className="empty-state">No se encontraron usuarios.</p>
            ) : (
              <div className="tabla-usuarios-container">
                <table className="tabla-usuarios">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>RUT</th>
                      <th>Área</th>
                      <th>Cargo</th>
                      <th>Gerencia</th>
                      <th>Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.ID_USUARIO}>
                        <td>{u.NOMBRE_COMPLETO}</td>
                        <td>{u.RUT}</td>
                        <td>{u.AREA}</td>
                        <td>{u.CARGO}</td>
                        <td>{u.GERENCIA}</td>
                        <td>
                          <span className="rol-tag">{u.ROL}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          
        </div>
      )}


      {/* === MODAL DETALLE === */}
      {selected && (
        <div className="request-user-modal">
          <div className="request-user-modal-content">
            <button
              className="request-user-modal-close"
              onClick={() => {
                setSelected(null);
                setComment("");
              }}
            >
              ✖
            </button>


            <h3>📋 Detalle de Solicitud</h3>


            <div className="detalle-seccion">
              <p><b>Nº Solicitud:</b> {selected.NUMERO_SOLICITUD}</p>
              <p><b>Tipo:</b> {selected.TIPO_SOLICITUD}</p>
              <p><b>Solicitante:</b> {selected.NOMBRE_SOLICITANTE}</p>
              <p><b>Gerencia:</b> {selected.GERENCIA}</p>
              <p><b>Área:</b> {selected.AREA}</p>
              <p><b>Email:</b> {selected.EMAIL}</p>
              <p><b>Fecha:</b> {selected.FECHA_SOLICITUD}</p>
            </div>
            <hr />


            {renderBody(selected)}


            {/* === Bloque de comentario original === */}
            <div className="detalle-seccion comentario-seccion">
              <h4>💬 Comentario de la solicitud</h4>
              <p>{selected.COMENTARIO || "Sin comentarios"}</p>
            </div>


            {/* === Solo mostrar campo y botones si está pendiente === */}
            {selected.ESTADO_SOLICITUD === "PENDIENTE" && (
              <>
                <hr />
                <div className="detalle-seccion accion-seccion">
                  <h4>⚡ Acción del aprobador</h4>
                  <textarea
                    className="request-user-comment-box"
                    placeholder="Comentario (obligatorio si rechaza)"
                    maxLength={300}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  ></textarea>


                  <div className="request-user-modal-buttons">
                    <button
                      className="btn-reject"
                      onClick={() => handleAction(selected.ID_SOLICITUD, "RECHAZADO")}
                    >
                      Rechazar
                    </button>
                    <button
                      className="btn-approve"
                      onClick={() => handleAction(selected.ID_SOLICITUD, "APROBADO")}
                    >
                      Aprobar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>     
        </div>      
      )}
    </div>
  );
}