import React, { useEffect, useState } from "react";
import api from "../../config/axiosInstance";
import BASE_URL from "../../config/apiConfig";
import "../../styles/request_dashboard.css";

export default function UsuariosSistema() {
  const [usuarios, setUsuarios] = useState([]);
  const [estanquesDisponibles, setEstanquesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showEstanquesModal, setShowEstanquesModal] = useState(false);
  const [usuarioEstanques, setUsuarioEstanques] = useState([]);
  
  const [form, setForm] = useState({
    id: null,
    nombre: "",
    rut: "",
    email: "",
    gerencia: "",
    area: "",
    cargo: "",
    nombre_usuario: "",
    password: "",
    rol: "SOLICITANTE",
    activo: true,
    estanques: [], // IDs de estanques seleccionados
  });

  // === Cargar usuarios y estanques disponibles ===
  const fetchUsuarios = async () => {
    try {
      const res = await api.get("/usuarios");
      setUsuarios(res.data);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstanquesDisponibles = async () => {
    try {
      const res = await api.get("/estanques_disponibles");
      setEstanquesDisponibles(res.data);
    } catch (err) {
      console.error("Error al cargar estanques:", err);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchEstanquesDisponibles();
  }, []);

  const filtered = usuarios.filter((u) =>
    `${u.nombre} ${u.email} ${u.nombre_usuario}`.toLowerCase().includes(search.toLowerCase())
  );

  // === Crear o editar usuario ===
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación de estanques para rol BODEGA
    if (form.rol === "BODEGA" && form.estanques.length === 0) {
      alert("⚠️ Debe asignar al menos un estanque para el rol BODEGA");
      return;
    }

    try {
      if (editMode) {
        // EDITAR
        const res = await api.put(`/update_user/${form.id}`, form)
        if (res.data.status === "ok") {
          alert("✅ Usuario actualizado correctamente");
        } else {
          alert("⚠️ " + res.data.message);
        }
      } else {
        // CREAR
        const res = await api.post("/register_user", form);
        if (res.data.status === "ok") {
          alert("✅ Usuario creado correctamente");
        } else {
          alert("⚠️ " + res.data.message);
        }
      }
      setShowModal(false);
      fetchUsuarios();
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      alert("❌ No se pudo guardar el usuario");
    }
  };

  // === Editar usuario ===
  const handleEdit = (u) => {
    setEditMode(true);
    setForm({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rut: u.rut || "",
      gerencia: u.gerencia || "",
      area: u.area || "",
      cargo: u.cargo || "",
      nombre_usuario: u.nombre_usuario || "",
      password: "",
      rol: u.rol || "SOLICITANTE",
      activo: u.estado === "Activo",
      estanques: u.estanques ? u.estanques.map(e => e.id) : [],
    });
    setShowModal(true);
  };

  // === Ver estanques de un usuario ===
  const handleVerEstanques = (u) => {
    setUsuarioEstanques(u.estanques || []);
    setShowEstanquesModal(true);
  };

  // === Eliminar usuario ===
  const handleDelete = async (u) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${u.nombre}?`)) return;
    try {
      const res = await api.delete(`/delete_user/${u.id}`);
      if (res.data.status === "ok") {
        alert("🗑️ Usuario eliminado");
        fetchUsuarios();
      } else {
        alert("⚠️ " + res.data.message);
      }
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      alert("❌ No se pudo eliminar el usuario");
    }
  };

  // === Toggle de estanque en el form ===
  const toggleEstanque = (idEstanque) => {
    setForm(prev => {
      const estanques = prev.estanques.includes(idEstanque)
        ? prev.estanques.filter(id => id !== idEstanque)
        : [...prev.estanques, idEstanque];
      return { ...prev, estanques };
    });
  };

  // === Agrupar estanques por ubicación ===
  const estanquesPorUbicacion = estanquesDisponibles.reduce((acc, est) => {
    const ubicacion = est.ubicacion || "Sin ubicación";
    if (!acc[ubicacion]) acc[ubicacion] = [];
    acc[ubicacion].push(est);
    return acc;
  }, {});

  return (
    <div className="request-user-dashboard-container">
      <div className="request-user-dashboard-header">
        <div>
          <h1>Usuarios del Sistema</h1>
          <p>Gestiona los usuarios que pueden acceder al sistema de solicitudes y combustibles</p>
        </div>
        <button
          className="new-user-button"
          onClick={() => {
            setEditMode(false);
            setForm({
              id: null,
              nombre: "",
              rut: "",
              email: "",
              gerencia: "",
              area: "",
              cargo: "",
              nombre_usuario: "",
              password: "",
              rol: "SOLICITANTE",
              activo: true,
              estanques: [],
            });
            setShowModal(true);
          }}
        >
          + Nuevo Usuario
        </button>
      </div>

      <div className="user-list-card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Cargando usuarios...</p>
          </div>
        ) : (
          <>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Buscar por nombre, email o usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <table className="user-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Estanques</th>
                  <th>Fecha de Creación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>{u.nombre_usuario}</td>
                    <td><span className="role-tag">{u.rol || "—"}</span></td>
                    <td>
                      <span
                        className={
                          u.estado === "Activo" ? "status-tag active" : "status-tag inactive"
                        }
                      >
                        {u.estado}
                      </span>
                    </td>
                    <td>
                      {u.rol === "BODEGA" ? (
                        <button 
                          className="btn-estanques"
                          onClick={() => handleVerEstanques(u)}
                        >
                          🛢️ Ver ({u.estanques?.length || 0})
                        </button>
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
                      )}
                    </td>
                    <td>{u.fecha_creacion}</td>
                    <td>
                      <button className="icon-btn edit" onClick={() => handleEdit(u)}>✏️</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(u)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* === MODAL CREAR/EDITAR === */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <button 
              className="request-user-modal-close"
              onClick={() => setShowModal(false)}
            >
              ✖
            </button>
            
            <h2>{editMode ? "Editar Usuario" : "Nuevo Usuario"}</h2>
            
            <form onSubmit={handleSubmit} className="form-modal">
              <div className="form-grid">
                <div className="form-section">
                  <h3>Información Personal</h3>
                  <input
                    type="text"
                    placeholder="Nombre completo *"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required
                  />
                  <input
                    type="text"
                    placeholder="RUT"
                    value={form.rut}
                    onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Correo electrónico *"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-section">
                  <h3>Información Laboral</h3>
                  <input
                    type="text"
                    placeholder="Gerencia"
                    value={form.gerencia}
                    onChange={(e) => setForm({ ...form, gerencia: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Área"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  />
                </div>

                <div className="form-section">
                  <h3>Credenciales del Sistema</h3>
                  <input
                    type="text"
                    placeholder="Usuario del sistema *"
                    value={form.nombre_usuario}
                    onChange={(e) => setForm({ ...form, nombre_usuario: e.target.value })}
                    required
                  />
                  {!editMode && (
                    <input
                      type="password"
                      placeholder="Contraseña *"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  )}
                  {editMode && (
                    <input
                      type="password"
                      placeholder="Nueva contraseña (dejar vacío para no cambiar)"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  )}
                </div>

                <div className="form-section">
                  <h3>Rol y Permisos</h3>
                  <select
                    value={form.rol}
                    onChange={(e) => {
                      setForm({ ...form, rol: e.target.value, estanques: [] });
                    }}
                    required
                  >
                    <option value="">Seleccione un rol *</option>
                    <option value="SOLICITANTE">Solicitante</option>
                    <option value="BODEGA">Bodega</option>
                    <option value="COMPRAS">Compras</option>
                    <option value="ADMIN_TI">Administrador TI</option>
                  </select>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    />
                    <span>Usuario Activo</span>
                  </label>
                </div>
              </div>

              {/* === SECCIÓN DE ESTANQUES (solo para BODEGA) === */}
              {form.rol === "BODEGA" && (
                <div className="estanques-section">
                  <h3>🛢️ Asignación de Estanques</h3>
                  <p className="help-text">
                    Seleccione los estanques a los que este usuario de bodega tendrá acceso
                  </p>

                  <div className="estanques-grid">
                    {Object.entries(estanquesPorUbicacion).map(([ubicacion, estanques]) => (
                      <div key={ubicacion} className="ubicacion-group">
                        <h4 className="ubicacion-title">📍 {ubicacion}</h4>
                        <div className="estanques-list">
                          {estanques.map((est) => (
                            <label key={est.id} className="estanque-checkbox">
                              <input
                                type="checkbox"
                                checked={form.estanques.includes(est.id)}
                                onChange={() => toggleEstanque(est.id)}
                              />
                              <div className="estanque-info">
                                <span className="estanque-nombre">{est.nombre}</span>
                                <span className="estanque-capacidad">
                                  {est.capacidad.toLocaleString()} L
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {form.estanques.length === 0 && (
                    <div className="warning-box">
                      ⚠️ Debe seleccionar al menos un estanque para el rol BODEGA
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  {editMode ? "Guardar Cambios" : "Crear Usuario"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL VER ESTANQUES === */}
      {showEstanquesModal && (
        <div className="modal-overlay">
          <div className="modal">
            <button 
              className="request-user-modal-close"
              onClick={() => setShowEstanquesModal(false)}
            >
              ✖
            </button>
            
            <h2>🛢️ Estanques Asignados</h2>
            
            {usuarioEstanques.length === 0 ? (
              <p className="empty-state">No hay estanques asignados</p>
            ) : (
              <div className="estanques-detail-list">
                {usuarioEstanques.map((est) => (
                  <div key={est.id} className="estanque-detail-card">
                    <div className="estanque-detail-header">
                      <span className="estanque-detail-nombre">{est.nombre}</span>
                      <span className="badge-ubicacion">{est.ubicacion}</span>
                    </div>
                    <div className="estanque-detail-body">
                      <p>
                        <b>Capacidad:</b> {est.capacidad.toLocaleString()} Litros
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowEstanquesModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}