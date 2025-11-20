import React, { useEffect, useState } from "react";
import axios from "axios";
import { CircularProgress, Snackbar, Alert } from "@mui/material";
import { Button } from "@mui/material";
import BASE_URL from "../../config/apiConfig";
import "../../styles/request_dashboard.css";

export default function DashboardBuyers() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", type: "success" });

  // === Filtros ===
  const [busqueda, setBusqueda] = useState("");
  const [almacenes, setAlmacenes] = useState(["todos"]);
  const [almacenFiltro, setAlmacenFiltro] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // === Modales ===
  const [modalDetalle, setModalDetalle] = useState({ open: false, doc: null, tipo: null });
  const [modalPdf, setModalPdf] = useState({ open: false, url: null });
  const [modalActualizar, setModalActualizar] = useState({ open: false, doc: null, item: null });

  // === Datos asociados ===
  const [estanques, setEstanques] = useState([]);
  const [factura, setFactura] = useState(null);
  const [formUpdate, setFormUpdate] = useState({ price: "", quantity: "" });

  // === Paginación ===
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const [paginaPedidos, setPaginaPedidos] = useState(1);
  const elementosPorPagina = 5;

  const normalizarAlmacen = (codigo) => {
  if (!codigo) return "—";
  const valor = codigo.toString().trim().toUpperCase();

  if (valor.includes("LAMBERT")) return "BOD_LAM";
  if (valor.includes("SAN ANTONIO")) return "BOD_SAN";
  if (valor.includes("TALCUNA")) return "BOD_TAL";

  return valor;
};
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [resSol, resPed] = await Promise.all([
        axios.get(`${BASE_URL}/sap/solicitudes_abiertas`),
        axios.get(`${BASE_URL}/sap/pedidos_abiertos`)
      ]);

      const solicitudesData = resSol.data?.data || [];
      const pedidosData = resPed.data?.data || [];

      const setAlm = new Set();
      [...solicitudesData, ...pedidosData].forEach((d) =>
        d.Lineas?.forEach((l) => l.WarehouseCode && setAlm.add(l.WarehouseCode))
      );

      setAlmacenes(["todos", ...Array.from(setAlm)]);
      setSolicitudes(solicitudesData);
      setPedidos(pedidosData);
    } catch (err) {
      console.error("❌ Error al cargar datos SAP:", err);
      setSnackbar({ open: true, message: "Error al cargar datos desde SAP.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // === Funciones de utilidad ===
  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    try {
      return new Date(fecha).toLocaleDateString("es-CL");
    } catch {
      return fecha;
    }
  };

  const formatoCLP = (valor) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(valor || 0);

  // === Filtros ===
  const filtrar = (docs) =>
    docs.filter((d) => {
      const texto = `${d.DocNum} ${d.CardName || ""} ${d.RequesterName || ""} ${
        d.Comentarios || ""
      }`.toLowerCase();
      const coincideTexto = texto.includes(busqueda.toLowerCase());
      const coincideAlmacen =
        almacenFiltro === "todos" ||
        d.Lineas?.some((l) => l.WarehouseCode?.toLowerCase() === almacenFiltro.toLowerCase());

      let coincideFecha = true;
      if (fechaDesde && fechaHasta && d.DocDate) {
        const fechaDoc = new Date(d.DocDate);
        coincideFecha =
          fechaDoc >= new Date(fechaDesde) && fechaDoc <= new Date(fechaHasta);
      }

      return coincideTexto && coincideAlmacen && coincideFecha;
    });

  const solicitudesFiltradas = filtrar(solicitudes);
  const pedidosFiltrados = filtrar(pedidos);

  // === Paginación ===
  const totalPagSolicitudes = Math.ceil(solicitudesFiltradas.length / elementosPorPagina);
  const totalPagPedidos = Math.ceil(pedidosFiltrados.length / elementosPorPagina);

  const solicitudesPagina = solicitudesFiltradas.slice(
    (paginaSolicitudes - 1) * elementosPorPagina,
    paginaSolicitudes * elementosPorPagina
  );
  const pedidosPagina = pedidosFiltrados.slice(
    (paginaPedidos - 1) * elementosPorPagina,
    paginaPedidos * elementosPorPagina
  );

  // === Acciones ===
  const verPdf = (doc) => {
    const pdfName = `${doc.DocNum}.pdf`;
    const pdfUrl = `${BASE_URL}/pdfs/${pdfName}`
    setModalPdf({ open: true, url: pdfUrl });
  };

  const verPdfPedido = (doc) => {
    const pdfName = `${doc.NUMERO_SOLICITUD_SAP}.pdf`;
    const pdfUrl = `${BASE_URL}/pdfs/${pdfName}`
    setModalPdf({ open: true, url: pdfUrl });
  };

  const convertirAPedido = async (solicitud) => {
    if (!window.confirm(`¿Convertir solicitud N° ${solicitud.DocNum} en pedido SAP?`)) return;
    try {
      const res = await axios.post(`${BASE_URL}/sap/convertir_a_pedido`, {
        DocEntry: solicitud.DocEntry,
        CardCode: solicitud.Lineas?.[0]?.LineVendor || "PN99520000-7",
      });

      if (res.data.status === "ok") {
        setSnackbar({
          open: true,
          type: "success",
          message: "Solicitud convertida correctamente en pedido.",
        });
        cargarDatos();
      } else throw new Error(res.data.mensaje || "Error desconocido.");
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        type: "error",
        message: "Error al convertir solicitud a pedido.",
      });
    }
  };

  const verDetalle = async (doc, tipo) => {
  setModalDetalle({ open: true, doc, tipo });

  // Limpieza inicial
  setEstanques([]);
  setFactura(null);

  try {
    let url = "";
    let params = {};

    if (tipo === "pedido") {
      url = `${BASE_URL}/seguimiento_estanques`;
      params = { numero_pedido: doc.DocNum };
    } else if (tipo === "solicitud") {
      url = `${BASE_URL}/seguimiento_solicitudes`;
      params = { numero_solicitud: doc.DocNum };
    } else {
      return;
    }

    const res = await axios.get(url, { params });


    if (res.data && res.data.distribuciones) {
      setEstanques(res.data.distribuciones);
      setFactura(res.data.factura || null);
    } else {
      setEstanques([]);
      setFactura(null);
    }
  } catch (err) {
    console.error("❌ Error al obtener detalle:", err);
    setEstanques([]);
    setFactura(null);
  }
};


  const abrirActualizar = async (doc, item) => {
    try {
      setModalActualizar({ open: true, doc, item });
      setFormUpdate({ price: "", quantity: "" });

      const res = await axios.get(`${BASE_URL}/sap/obtener_datos_ocr`, {
        params: { pedido: doc.DocNum },
      });

      if (res.data.status === "ok") {
        const { precio_unitario, cantidad } = res.data.data;
        setFormUpdate({
          price: precio_unitario.toString(),
          quantity: cantidad.toString(),
        });
      }
    } catch (err) {
      console.warn("⚠️ No se encontraron datos OCR.");
    }
  };

  // === Render ===
  return (
    <div className="request-user-dashboard-container">
      <h2 className="request-user-dashboard-title">📦 Dashboard de Compras</h2>
      <p className="request-user-dashboard-subtitle">
        Visualiza solicitudes y pedidos, con sus distribuciones.
      </p>

  <div className="filter-card">
  <div className="filter-grid">
    <input
      type="text"
      placeholder="Buscar por número, proveedor o solicitante..."
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
    />
    <select
      value={almacenFiltro}
      onChange={(e) => setAlmacenFiltro(e.target.value)}
    >
      {almacenes.map((a, i) => (
        <option key={i} value={a}>
          {a === "todos" ? "Todos los almacenes" : a}
        </option>
      ))}
    </select>

    <div className="date-filters">
      <label>Desde</label>
      <input
        type="date"
        value={fechaDesde}
        onChange={(e) => setFechaDesde(e.target.value)}
      />
      <label>Hasta</label>
      <input
        type="date"
        value={fechaHasta}
        onChange={(e) => setFechaHasta(e.target.value)}
      />
    </div>

    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
  
      <Button
            variant="contained"
            color="error"
            onClick={() =>
              window.open(`${BASE_URL}/export_facturas`, "_blank")
            }
          >
            ⬇ Exportar Excel
          </Button>
        </div>
      </div>     
    </div>

      {loading ? (
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <CircularProgress />
          <p>Cargando datos desde SAP...</p>
        </div>
      ) : (
        <>
{/* === Solicitudes === */}


<h2 style={{ marginTop: "40px" }}>📦 Solicitudes de compra</h2>

{solicitudesFiltradas.length === 0 ? (
  <p>No se encontraron solicitudes abiertas.</p>
) : (
  <div className="request-user-cards-grid">
    {solicitudesPagina.map((s) => {
      // === Diccionario de nombres y colores por almacén ===
      const almacenesInfo = {
        BOD_TAL: { nombre: "Talcuna", color: "#2563eb" },      // Azul petróleo
        BOD_SAN: { nombre: "San Antonio", color: "#16a34a" },  // Verde esmeralda
        BOD_LAM: { nombre: "Lambert", color: "#7c3aed" },      // Morado intenso
      };

      const proveedor = s.CardName || s.Lineas?.[0]?.LineVendorName || "—";
      const rut = s.CardCode || s.Lineas?.[0]?.LineVendor || "—";

      const almacenCode = normalizarAlmacen(
        s.WarehouseCode || s.Lineas?.[0]?.WarehouseCode || "—"
          );
      const infoAlmacen =
        almacenesInfo[almacenCode] || { nombre: almacenCode, color: "#9ca3af" };


      // === Unificar líneas para render ===
      let lineasParaRenderizar = [];
      if (s.Lineas && s.Lineas.length > 0) {
        lineasParaRenderizar = s.Lineas;
      } else if (!s.Lineas && (s.ItemDescription || s.Quantity)) {
        lineasParaRenderizar = [
          {
            ItemDescription: s.ItemDescription,
            WarehouseCode: s.WarehouseCode,
            Quantity: s.Quantity,
          },
        ];
      }
            return (
              <div key={s.DocNum} className="request-user-card pending">
                {/* === Encabezado === */}
                <div className="request-user-card-header">
                  <div className="header-left">
                    <span className="request-user-id">
                      N° Solicitud: <b>{s.DocNum}</b>
                      
                    </span>       
                         
                  </div>          
                  <span className="warehouse-badge" style={{ background: infoAlmacen.color }}> {infoAlmacen.nombre} </span>                  
                </div>
                {/* === Cuerpo principal === */}
                <div className="request-user-card-body">
                  <p>
                    <b>Solicitante:</b> {(s.Requester)}
                  </p>
                  <p>
                    <b>Proveedor:</b> {proveedor}
                  </p>
                  <p>
                    <b>RUT:</b> {rut}
                  </p>
                  <p>
                    <b>Fecha de Ingreso:</b> {formatearFecha(s.DocDate)}
                  </p>
                  <p>
                    <b>Fecha de Vencimiento:</b> {formatearFecha(s.DocDueDate)}
                  </p>

                  <hr />

                  {/* === Líneas === */}
                  {lineasParaRenderizar.length > 0 ? (
                    lineasParaRenderizar.map((l, j) => (
                      <div key={`${s.DocNum}-${j}`}>
                        <p>
                          <b>Artículo:</b> {l.ItemDescription || "—"}
                        </p>
                        <p>
                          <b>Cantidad:</b> {l.Quantity || 0} L
                        </p>
                        {j < lineasParaRenderizar.length - 1 && <hr />}
                      </div>
                    ))
                  ) : (
                    <p>
                      <i>Esta solicitud no tiene líneas de detalle.</i>
                    </p>
                  )}
                </div>

                {/* === Footer === */}
                <div className="request-user-card-footer">
                  <button
                    className="btn-detail"
                    onClick={() => verDetalle(s, "solicitud")}
                  >
                    Ver Detalle
                  </button>
                  <button className="btn-approve" onClick={() => convertirAPedido(s)}>
                    Convertir a Pedido
                  </button>
                  <button className="btn-detail" onClick={() => verPdf(s)}>
                    Ver PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


          {/* === Paginación solicitudes === */}
          {totalPagSolicitudes > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary"
                disabled={paginaSolicitudes === 1}
                onClick={() => setPaginaSolicitudes(paginaSolicitudes - 1)}
              >
                ← Anterior
              </button>
              <span>Página {paginaSolicitudes} de {totalPagSolicitudes}</span>
              <button
                className="btn-secondary"
                disabled={paginaSolicitudes === totalPagSolicitudes}
                onClick={() => setPaginaSolicitudes(paginaSolicitudes + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* === Pedidos === */}
<h2 style={{ marginTop: "40px" }}>📦 Pedidos</h2>

{pedidosFiltrados.length === 0 ? (
  <p>No se encontraron pedidos abiertos.</p>
) : (
  <div className="request-user-cards-grid">
    {pedidosPagina.map((p, i) => {
      // === Diccionario de almacenes ===
      const almacenesInfo = {
        BOD_TAL: { nombre: "Talcuna", color: "#2563eb" },
        BOD_SAN: { nombre: "San Antonio", color: "#16a34a" },
        BOD_LAM: { nombre: "Lambert", color: "#7c3aed" },
      };

      const almacenCode = normalizarAlmacen(
        p.WarehouseCode || p.Lineas?.[0]?.WarehouseCode || "—"
      );

      const infoAlmacen =
        almacenesInfo[almacenCode] || { nombre: almacenCode, color: "#9ca3af" };

      return (
        <div key={i} className="request-user-card approved2">
          {/* === Encabezado === */}
          <div className="request-user-card-header">
            <div className="header-left">
              <span className="request-user-id">
                N° Pedido: <b>{p.DocNum}  </b>
                 
                | S° SAP:<b>{p.NUMERO_SOLICITUD_SAP}</b>
              </span>
              <span
                className="warehouse-badge"
                style={{ background: infoAlmacen.color }}
              >
                {infoAlmacen.nombre}
              </span>
            </div>
          </div>

          {/* === Cuerpo principal === */}
          <div className="request-user-card-body">
            
            <p>
              <b>Proveedor:</b> {p.CardName}
            </p>
            <p>
              <b>RUT:</b> {p.CardCode || "—"}
            </p>
            <p>
              <b>Fecha de Ingreso:</b> {formatearFecha(p.DocDate)}
            </p>
            <p>
              <b>Fecha de Vencimiento:</b> {formatearFecha(p.DocDueDate)}
            </p>
            <p>
              <b>Fecha documento:</b> {formatearFecha(p.FECHA_EMISION)}
            </p>

            <hr />

            {/* === Detalle de líneas === */}
            {p.Lineas && p.Lineas.length > 0 ? (
              p.Lineas.map((l, j) => (
                <div key={j}>
                  <p>
                    <b>Artículo:</b> {l.ItemDescription || "—"}
                  </p>
                  <p>
                    <b>Almacén:</b> {l.WarehouseCode || "—"}
                  </p>
                  <p>
                    <b>Cantidad:</b> {l.Quantity || 0} L
                  </p>
                  {j !== p.Lineas.length - 1 && <hr />}
                </div>
              ))
            ) : (
              <>
                <p>
                  <b>Artículo:</b> {p.ItemDescription || "—"}
                </p>
                <p>
                  <b>Almacén:</b> {p.WarehouseCode || "—"}
                </p>
                <p>
                  <b>Cantidad:</b> {p.Quantity || 0} L
                </p>
              </>
            )}
          </div>

          <div className="request-user-card-footer">
            <button
              className="btn-detail"
              onClick={() => verDetalle(p, "pedido")}
            >
              Ver Detalle
            </button>
            <button
              className="btn-approve"
              onClick={() => abrirActualizar(p, p.Lineas?.[0])}
            >
              Entrada Mercancía
            </button>

            <button className="btn-detail" onClick={() => verPdfPedido(p)}>
              Ver PDF
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
          {/* === Paginación pedidos === */}
          {totalPagPedidos > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary"
                disabled={paginaPedidos === 1}
                onClick={() => setPaginaPedidos(paginaPedidos - 1)}
              >
                ← Anterior
              </button>
              <span>Página {paginaPedidos} de {totalPagPedidos}</span>
              <button
                className="btn-secondary"
                disabled={paginaPedidos === totalPagPedidos}
                onClick={() => setPaginaPedidos(paginaPedidos + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}

      {/* === Modales Detalle, PDF y Actualización === */}
      {modalDetalle.open && (
        <div className="request-user-modal" onClick={(e) => {
          if (e.target.classList.contains("request-user-modal")) {
            setModalDetalle({ open: false, doc: null, tipo: null });
          }
        }}>
          <div className="request-user-modal-content">
            <button className="request-user-modal-close" onClick={() => setModalDetalle({ open: false, doc: null, tipo: null })}>✖</button>
            <h2>Detalles de {modalDetalle.tipo === "pedido" ? "Pedido" : "Solicitud"} #{modalDetalle.doc?.DocNum}</h2>
            <hr />
            <p><b>Proveedor:</b> {modalDetalle.doc?.CardName}</p>
            <p><b>RUT:</b> {modalDetalle.doc?.CardCode}</p>
            <p><b>Fecha de Ingreso:</b> {formatearFecha(modalDetalle.doc?.DocDate)}</p>
            
            <hr />
            <h4>Artículos</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>         
                  <th>Almacén</th>
                  <th>Cantidad Total</th>
                </tr>
              </thead>
              <tbody>
                {modalDetalle.doc?.Lineas?.map((l, i) => (
                  <tr key={i}>
                    <td>{l.ItemDescription}</td>
                    <td>{l.ItemCode}</td>
                    
                    <td>{l.WarehouseCode}</td>
                    <td>{l.Quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4 style={{ marginTop: "20px" }}>Distribución de estanques</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Estanque</th>
                  <th>Ubicación</th>
                  <th>Litros Asignados</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(estanques) && estanques.length > 0 ? (
                  estanques.map((e, i) => (
                    <tr key={i}>
                      <td>{e.ESTANQUE || "—"}</td>
                      <td>{e.UBICACION || "—"}</td>
                      <td>{e.LITROS_ASIGNADOS ? `${e.LITROS_ASIGNADOS.toLocaleString("es-CL")} L` : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center", color: "#777" }}>
                      No hay distribución registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {modalDetalle.tipo === "pedido" && Array.isArray(estanques) && estanques.length > 0 && (
              <>
                <h4 style={{ marginTop: "20px" }}>Impuestos Unitarios</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Precio base</th>
                      <th>IEV</th>
                      <th>IEF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estanques.map((e, i) => (
                      <tr key={i}>
                        <td>{e.PBASE_SI_U ? e.PBASE_SI_U : "—"}</td>
                        <td>{e.IEV_U ? e.IEV_U : "—"}</td>
                        <td>{e.IEF_U ? e.IEF_U : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 style={{ marginTop: "20px" }}>Impuestos</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Base Afecta</th>
                      <th>IVA</th>
                      <th>IEV</th>
                      <th>IEF</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatoCLP(factura.BASE_AFECTA)}</td>
                      <td>{formatoCLP(factura.IVA)}</td>
                      <td>{formatoCLP(factura.IEV)}</td>
                      <td>{formatoCLP(factura.IEF)}</td>
                      <td>{formatoCLP(factura.TOTAL)}</td>
                    </tr>
                  </tbody>
                </table>
              </>            
            )}
          </div>  
        </div>
      )}

      {modalActualizar.open && (
        <div className="request-user-modal">
          <div className="request-user-modal-content">
            <button className="request-user-modal-close" onClick={() => setModalActualizar({ open: false, doc: null, item: null })}>✖</button>
            <h3>Ingresa el valor del articulo, para el Pedido #{modalActualizar.doc.DocNum}</h3>
            <p className="request-user-dashboard-subtitle">
              Confirma el valor unitario del articulo y envialo para crear la entrada de mercancias.
            </p>
            <p><b>Artículo:</b> {modalActualizar.item.ItemDescription}</p>
            <p><b>Almacén:</b> {modalActualizar.item.WarehouseCode}</p>

            <input
              type="number"
              placeholder="Precio unitario"
              value={formUpdate.price}
              onChange={(e) => setFormUpdate({ ...formUpdate, price: e.target.value })}
              style={{ marginTop: 10, padding: 8, width: "100%" }}
            />
            <input
              type="number"
              placeholder="Cantidad (L)"
              value={formUpdate.quantity}
              onChange={(e) => setFormUpdate({ ...formUpdate, quantity: e.target.value })}
              style={{ marginTop: 10, padding: 8, width: "100%" }}
            />
          </div>
        </div>

        
      )}

      {modalPdf.open && (
        <div className="request-user-modal">
          <div className="request-user-modal-content" style={{ width: "80%", height: "80%" }}>
            <button className="request-user-modal-close" onClick={() => setModalPdf({ open: false, url: null })}>✖</button>
            {modalPdf.url ? (
              <iframe src={modalPdf.url} width="100%" height="100%" title="Vista PDF" style={{ border: "none" }} />
            ) : (
              <p>No se encontró el PDF.</p>
            )}
          </div>
        </div>
      )}
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
