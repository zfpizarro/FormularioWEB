import React, { useEffect, useState } from "react";
import api from "../../config/axiosInstance";
import BASE_URL from "../../config/apiConfig";
import { Snackbar, Alert, CircularProgress } from "@mui/material";
import { Button } from "@mui/material";
import "../../styles/panel.css";

export default function DashboardBuyersWithOutSAP() {
  const [facturas, setFacturas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", type: "success" });

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 10;

  const [modalPdf, setModalPdf] = useState({ open: false, url: null });
  const [modalDetalle, setModalDetalle] = useState({ open: false, doc: null });

  const [estanques, setEstanques] = useState([]);
  const [facturaDetalle, setFacturaDetalle] = useState(null);

  const [filtroEstadoFactura, setFiltroEstadoFactura] = useState("todos");


  const [filtroUbicacion, setFiltroUbicacion] = useState("todos"); // 🔹 Nuevo para ubicación

  const fetchFacturas = async () => {
    setLoading(true);
    try {
      const res = await api.get("/facturas");
      let data = res.data || [];
      const roles = JSON.parse(localStorage.getItem("roles") || "[]");
      const estanquesAsignados = JSON.parse(localStorage.getItem("estanques_asignados") || "[]");
      const codigosAsignados = estanquesAsignados.map(e => e.codigo?.toUpperCase());
      const esCompras = roles.includes("COMPRAS") || roles.includes("ADMIN_TI");
        if (!esCompras && codigosAsignados.length > 0) {
          data = data.filter(f => {
            const ubicacion = (f.UBICACION || "").toUpperCase();
            return codigosAsignados.some(codigo =>
              ubicacion.includes(codigo) ||
              codigo.includes(ubicacion)
            );
          });
        }

      setFacturas(data);
      setFiltered(data);
      
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, type: "error", message: "Error al cargar facturas desde BD." });
    } finally {
      setLoading(false);
    }
  
  };

  useEffect(() => {
  fetchFacturas();
}, []);


  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    try {
      return new Date(fecha).toLocaleDateString("es-CL");
    } catch {
      return fecha;
    }
  };

  useEffect(() => {
  let res = [...facturas];

  // 🔍 Filtro por texto
  if (filtroTexto.trim()) {
    const txt = filtroTexto.toLowerCase();
    res = res.filter(
      (f) =>
        f.NUMERO_FACTURA?.toString().includes(txt) ||
        f.NOMBRE_EMISOR?.toLowerCase().includes(txt) ||
        f.NUMERO_SOLICITUD_SAP?.toString().includes(txt)
    );
  }

  // 🏭 Filtro por ubicación
  if (filtroUbicacion !== "todos") {
  res = res.filter((f) => (f.UBICACION || "").toLowerCase().includes(filtroUbicacion.toLowerCase()));
}

  // 📦 Filtro por estado factura
  if (filtroEstadoFactura !== "todos") {
    res = res.filter((f) => {
      if (filtroEstadoFactura === "pendientes") return !f.NUMERO_PEDIDO;
      if (filtroEstadoFactura === "proceso") return f.NUMERO_PEDIDO && !f.ENTRADA_MERCANCIA;
      if (filtroEstadoFactura === "completadas") return f.ENTRADA_MERCANCIA;
      return true;
    });
  }

  // 📅 Filtro por fecha
  if (fechaDesde && fechaHasta) {
    res = res.filter((f) => {
      const fecha = new Date(f.FECHA_EMISION);
      return fecha >= new Date(fechaDesde) && fecha <= new Date(fechaHasta);
    });
  }

  setFiltered(res);
  setPaginaActual(1);
}, [filtroTexto, filtroUbicacion, filtroEstadoFactura, fechaDesde, fechaHasta, facturas]);


  // === Filtros ===
  useEffect(() => {
    let res = [...facturas];
    if (filtroTexto.trim()) {
      const txt = filtroTexto.toLowerCase();
      res = res.filter(
        (f) =>
          f.NUMERO_FACTURA?.toString().includes(txt) ||
          f.NOMBRE_EMISOR?.toLowerCase().includes(txt) ||
          f.NUMERO_SOLICITUD_SAP?.toString().includes(txt)
      );
    }

    if (filtroEstado !== "todos") {
      res = res.filter((f) => {
        if (filtroEstado === "pendientes") return !f.NUMERO_PEDIDO;
        if (filtroEstado === "proceso") return f.NUMERO_PEDIDO && !f.ENTRADA_MERCANCIA;
        if (filtroEstado === "completadas") return f.ENTRADA_MERCANCIA;
        return true;
      });
    }

    if (fechaDesde && fechaHasta) {
      res = res.filter((f) => {
        const fecha = new Date(f.FECHA_EMISION);
        return fecha >= new Date(fechaDesde) && fecha <= new Date(fechaHasta);
      });
    }

    setFiltered(res);
    setPaginaActual(1);
  }, [filtroTexto, filtroEstado, fechaDesde, fechaHasta, facturas]);

  // === Utilidades ===
  const formatCLP = (v) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v || 0);

  const totalFacturas = filtered.length;
  const totalPendientes = filtered.filter((f) => !f.NUMERO_PEDIDO).length;
  const totalProceso = filtered.filter((f) => f.NUMERO_PEDIDO && !f.ENTRADA_MERCANCIA).length;
  const totalCompletadas = filtered.filter((f) => f.ENTRADA_MERCANCIA).length;

  // === Ver PDF ===
  const verPdf = (factura) => {
    if (!factura.NUMERO_SOLICITUD_SAP) {
      setSnackbar({
        open: true,
        type: "warning",
        message: "Esta factura no tiene número de solicitud SAP asociado.",
      });
      return;
    }
    const pdfUrl = `${import.meta.env.VITE_API_BASE_URL || "http://host.docker.internal:5000"}/pdfs/${factura.NUMERO_SOLICITUD_SAP}.pdf`;
    setModalPdf({ open: true, url: pdfUrl });
  };

  // === Ver Detalle ===
  const verDetalle = async (factura) => {
    setModalDetalle({ open: true, doc: factura });
    setFacturaDetalle(null);
    setEstanques([]);
    try {
      const idBusqueda = factura.NUMERO_SOLICITUD_SAP ;
      const res = await api.get("/seguimiento_solicitudes", {
        params: { numero_solicitud: idBusqueda },
      });

      if (res.data.distribuciones) {
        setEstanques(res.data.distribuciones);
        setFacturaDetalle(res.data.factura);
      }
    } catch (err) {
      console.error("Error al obtener detalle:", err);
    }
  };

  // === Paginación ===
  const totalPaginas = Math.ceil(filtered.length / elementosPorPagina);
  const facturasPagina = filtered.slice((paginaActual - 1) * elementosPorPagina, paginaActual * elementosPorPagina);

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">📦 Historial de Facturas Procesadas </h1>

      

      {/* === Stats === */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <h2>Total Facturas</h2>
          <p className="big">{totalFacturas}</p>
        </div>
        <div className="stat-card yellow">
          <h2>Pendientes</h2>
          <p className="big">{totalPendientes}</p>
        </div>
        <div className="stat-card green">
          <h2>En Proceso</h2>
          <p className="big">{totalProceso}</p>
        </div>
        
        <div className="stat-card gray">
          <h2>Completadas</h2>
          <p className="big">{totalCompletadas}</p>
        </div>
      </div>

{/* === FILTROS === */}
<div className="filter-card">
  <div className="filter-grid">
    {/* Buscar */}
    <input
      type="text"
      placeholder="Buscar por número, proveedor o RUT..."
      value={filtroTexto}
      onChange={(e) => setFiltroTexto(e.target.value)}
    />

    <select
      value={filtroUbicacion}
      onChange={(e) => setFiltroUbicacion(e.target.value)}
    >
      <option value="todos">Todas las ubicaciones</option>
      <option value="Talcuna">Talcuna</option>
      <option value="San Antonio">San Antonio</option>
      <option value="Lambert">Lambert</option>
    </select>


    {/* Estado */}
    <select
      value={filtroEstadoFactura}
      onChange={(e) => setFiltroEstadoFactura(e.target.value)}
    >
      <option value="todos">Todos los estados</option>
      <option value="pendientes">Pendientes</option>
      <option value="proceso">En proceso</option>
      <option value="completadas">Completadas</option>
    </select>

    {/* Fechas */}
    <div className="date-filters">
      <label>Desde</label>
      <input
        type="date"
        value={fechaDesde}
        onChange={(e) => setFechaDesde(e.target.value)}
      />
    </div>

    <div className="date-filters">
      <label>Hasta</label>
      <input
        type="date"
        value={fechaHasta}
        onChange={(e) => setFechaHasta(e.target.value)}
      />
    </div>
    <button
      className="btn-export"
      onClick={() => window.open(`${BASE_URL}/export_facturas`, "_blank")}
    >
      ↓ Exportar Excel
    </button>
  </div>
</div>



      {/* === Contenido === */}
      {loading ? (
        <div className="loading">
          <CircularProgress color="warning" />
          <p>Cargando datos...</p>
        </div>
      ) : (
        <>
          <div className="cards-container">
            {facturasPagina.length === 0 ? (
              <p className="no-data">No se encontraron facturas.</p>
            ) : (
              facturasPagina.map((f, i) => (
                <div
                  key={i}
                  className={`factura-card ${
                    f.ENTRADA_MERCANCIA ? "completada" : f.NUMERO_PEDIDO ? "proceso" : "pendiente"
                  }`}
                >
                  {/* === CABECERA ORDENADA === */}
                  <div className="factura-header enhanced-header">
                    <div className="header-top">
                      <div>
                        <strong>N° Solicitud:</strong> <span>{f.NUMERO_SOLICITUD_SAP || "—"}</span>
                      </div>
                      <div>
                        <span className="badge-ubicacion">{f.UBICACION || "—"}</span>
                      </div>
                      <div>
                        <strong>N° Factura:</strong> <span>{f.NUMERO_FACTURA || "—"}</span>
                      </div>
                      <span
                        className={`badge ${
                          f.ENTRADA_MERCANCIA
                            ? "badge-green"
                            : f.NUMERO_PEDIDO
                            ? "badge-yellow"
                            : "badge-gray"
                        }`}
                      >
                        {f.ENTRADA_MERCANCIA
                          ? "Completada"
                          : f.NUMERO_PEDIDO
                          ? "En Proceso"
                          : "Pendiente"}
                      </span>
                    </div>
                    <hr className="divider" />
                  </div>

                  {/* === CONTENIDO === */}
                  <div className="factura-proveedor">
                    <div className="info-section">
                      <p><b>N° Pedido:</b> {f.NUMERO_PEDIDO || "Aún no está disponible"}</p>
                      <p><b>N° Entrada de Mercancías:</b> {f.ENTRADA_MERCANCIA || "Aún no está disponible"}</p>
                      <p><b>Fecha de Emisión:</b> {formatearFecha(f.FECHA_INGRESO) || "—"}</p>
                    </div>

                    <hr className="divider" />

                    <div className="info-section">       
                      <p><b>Proveedor:</b> {f.NOMBRE_EMISOR || "—"}</p>
                      
                      <p><b>Fecha documento:</b> {formatearFecha(f.FECHA_EMISION) || "—"}</p>
                      <p><b>Total:</b> {f.TOTAL ? f.TOTAL.toLocaleString("es-CL") : "—"}</p>
                    </div>

                    <div className="card-buttons">
                      <button className="btn-view" onClick={() => verDetalle(f)}>Ver Detalle</button>
                      <button className="btn-view" onClick={() => verPdf(f)}>Ver PDF</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* === Paginación === */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 20,
              gap: "10px",
            }}
          >
            <button
              className="btn-secondary"
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual(paginaActual - 1)}
            >
              ← Anterior
            </button>
            <span>
              Página {paginaActual} de {totalPaginas || 1}
            </span>
            <button
              className="btn-secondary"
              disabled={paginaActual === totalPaginas || totalPaginas === 0}
              onClick={() => setPaginaActual(paginaActual + 1)}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}

      {/* === Modal Detalle === */}
      {modalDetalle.open && (
        <div className="pdf-modal">
          <div className="pdf-modal-content">
            <button
              className="btn-close"
              onClick={() => {
                setModalDetalle({ open: false, doc: null });
                setFacturaDetalle(null);
                setEstanques([]);
              }}
            >
              ✕
            </button>

            <h2>
              {modalDetalle.doc.NUMERO_PEDIDO
                ? `Detalles de Pedido #${modalDetalle.doc.NUMERO_PEDIDO}`
                : `Detalles de Solicitud #${modalDetalle.doc.NUMERO_SOLICITUD_SAP}`}
            </h2>

            {facturaDetalle && (
              <>
                <p><b>Solicitud SAP:</b> {facturaDetalle.NUMERO_SOLICITUD_SAP}</p>
                <p><b>N° Pedido:</b> {facturaDetalle.NUMERO_PEDIDO || "—"}</p>
                <p><b>Fecha:</b> {formatearFecha(facturaDetalle.FECHA_EMISION)}</p>
              </>
            )}


          


            <h3>Distribución por Estanques</h3>
            {estanques.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Ubicación</th>
                    <th>Estanque</th>
                    <th>Litros Asignados</th>
                  </tr>
                </thead>
                <tbody>
                  {estanques.map((e, i) => (
                    <tr key={i}>

                      <td>{e.UBICACION}</td>
                      <td>{e.ESTANQUE}</td>
                      
                      <td>{e.LITROS_ASIGNADOS}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No hay distribución registrada para esta factura.</p>
            )}

            {facturaDetalle && (
              <>
                <h3 style={{ marginTop: "20px" }}>Valores e Impuestos</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Base Afecta</th>
                      <th>FEEP</th>
                      <th>IEV</th>
                      <th>IEF</th>
                      <th>IVA</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatCLP(facturaDetalle.BASE_AFECTA)}</td>
                      <td>{formatCLP(facturaDetalle.FEEP)}</td>
                      <td>{formatCLP(facturaDetalle.IEV)}</td>
                      <td>{formatCLP(facturaDetalle.IEF)}</td>
                      <td>{formatCLP(facturaDetalle.IVA)}</td>
                      <td><b>{formatCLP(facturaDetalle.TOTAL)}</b></td>
                    </tr>
                  </tbody>
                </table>


                <h4>Impuestos Unitarios</h4>
                  {estanques.length > 0 && (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Precio base</th>
                          <th>IEV</th>
                          <th>IEF</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{estanques[0].PBASE_SI_U}</td>
                          <td>{estanques[0].IEV_U}</td>
                          <td>{estanques[0].IEF_U}</td>
                          <td>{formatCLP(estanques[0].SUBTOTAL)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}


              </>
            )}
          </div>


          
        </div>
      )}

      {/* === Modal PDF === */}
      {modalPdf.open && (
        <div className="pdf-modal2">
          <div className="pdf-modal2-content pdf-large">
            <button className="btn-close" onClick={() => setModalPdf({ open: false, url: null })}>
              ✕
            </button>
            {modalPdf.url ? (
              <iframe src={modalPdf.url} width="100%" height="100%" style={{ border: "none" }} title="Vista previa PDF" />
            ) : (
              <p>No se encontró el archivo PDF.</p>
            )}
          </div>
        </div>
      )}

      {/* === Snackbar === */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.type}>{snackbar.message}</Alert>
      </Snackbar>
    </div>
  );
}
