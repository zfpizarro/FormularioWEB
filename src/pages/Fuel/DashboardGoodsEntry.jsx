import React, { useEffect, useState } from "react";
import axios from "axios";
import { CircularProgress, Snackbar, Alert } from "@mui/material";
import { Button } from "@mui/material";

import "../../styles/request_dashboard.css";
import BASE_URL from "../../config/apiConfig";

export default function DashboardStore() {
  const [entradas, setEntradas] = useState([]);
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
  const [paginaPedidos, setPaginaPedidos] = useState(1);
  const [paginaEntradas, setPaginaEntradas] = useState(1);
  const elementosPorPagina = 5;



  // === Colores y nombres de almacenes ===
  const almacenesInfo = {
    BOD_TAL: { nombre: "Talcuna", color: "#2563eb" },
    BOD_LAM: { nombre: "Lambert", color: "#7c3aed" },
    BOD_SAN: { nombre: "San Antonio", color: "#16a34a" },
  };

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
    const roles = JSON.parse(localStorage.getItem("roles") || "[]");
    const estanquesAsignados = JSON.parse(localStorage.getItem("estanques_asignados") || "[]");
    const esCompras = roles.includes("COMPRAS") || roles.includes("ADMIN_TI");

    const normalizar = (valor) => {
      if (!valor) return "";
      const v = valor.toString().toUpperCase();
      if (v.includes("TALCUNA")) return "BOD_TAL";
      if (v.includes("LAMBERT")) return "BOD_LAM";
      if (v.includes("SAN ANTONIO")) return "BOD_SAN";
      return v;
    };

    const codigosAsignados = estanquesAsignados.map(e => normalizar(e.codigo));

    // Consultar datos SAP
    const [resPed, resEnt] = await Promise.all([
      axios.get(`${BASE_URL}/sap/pedidos_abiertos`),
      axios.get(`${BASE_URL}/sap/entradas_abiertas`)
    ]);

    let pedidosData = resPed.data?.data || [];
    let entradasData = resEnt.data?.data || [];

    // Filtrar solo si el usuario NO es compras ni admin
    if (!esCompras && codigosAsignados.length > 0) {
      pedidosData = pedidosData.filter(p =>
        p.Lineas?.some(l =>
          codigosAsignados.includes(normalizar(l.WarehouseCode))
        )
      );

      entradasData = entradasData.filter(e =>
        e.Lineas?.some(l =>
          codigosAsignados.includes(normalizar(l.WarehouseCode))
        )
      );
    }

    const setAlm = new Set();
    [...pedidosData, ...entradasData].forEach((d) =>
      d.Lineas?.forEach((l) => l.WarehouseCode && setAlm.add(l.WarehouseCode))
    );

    setAlmacenes(["todos", ...Array.from(setAlm)]);
    setPedidos(pedidosData);
    setEntradas(entradasData);
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

  // === Utilidades ===
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
      const texto = `${d.DocNum} ${d.CardName || ""} ${d.CardCode || ""} ${
        d.Comentarios || ""
      }`.toLowerCase();
      const coincideTexto = texto.includes(busqueda.toLowerCase());
      const coincideAlmacen =
        almacenFiltro === "todos" ||
        d.Lineas?.some(
          (l) => l.WarehouseCode?.toLowerCase() === almacenFiltro.toLowerCase()
        );

      let coincideFecha = true;
      if (fechaDesde && fechaHasta && d.DocDate) {
        const fechaDoc = new Date(d.DocDate);
        coincideFecha =
          fechaDoc >= new Date(fechaDesde) && fechaDoc <= new Date(fechaHasta);
      }

      return coincideTexto && coincideAlmacen && coincideFecha;
    });

  const pedidosFiltrados = filtrar(pedidos);
  const entradasFiltradas = filtrar(entradas);

  const totalPagPedidos = Math.ceil(pedidosFiltrados.length / elementosPorPagina);
  const totalPagEntradas = Math.ceil(entradasFiltradas.length / elementosPorPagina);

  const pedidosPagina = pedidosFiltrados.slice(
    (paginaPedidos - 1) * elementosPorPagina,
    paginaPedidos * elementosPorPagina
  );
  const entradasPagina = entradasFiltradas.slice(
    (paginaEntradas - 1) * elementosPorPagina,
    paginaEntradas * elementosPorPagina
  );

  const verPdf = (doc) => {
    const pdfName = `${doc.NUMERO_SOLICITUD_SAP || doc.DocNum}.pdf`;
    const pdfUrl = `${BASE_URL}/pdfs/${pdfName}`
    setModalPdf({ open: true, url: pdfUrl });
  };

  const verDetalle = async (doc, tipo = "entrada") => {
    setModalDetalle({ open: true, doc, tipo });
    setEstanques([]);
    setFactura(null);
    try {
      const res = await axios.get(`${BASE_URL}/seguimiento_estanques`, {
        params: { numero_pedido: doc.NUMERO_PEDIDO || doc.DocNum },
      });
      if (res.data && res.data.distribuciones) {
        setEstanques(res.data.distribuciones);
        setFactura(res.data.factura || null);
      }
    } catch (err) {
      console.error("❌ Error al obtener detalle:", err);
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
    } catch {
      console.warn("⚠️ No se encontraron datos OCR.");
    }
  };

  const guardarActualizacion = async () => {
    if (!modalActualizar.doc || !modalActualizar.item) return;
    const { price, quantity } = formUpdate;
    if (!price || !quantity || price <= 0 || quantity <= 0) {
      setSnackbar({
        open: true,
        type: "warning",
        message: "Debes ingresar un precio y cantidad válidos.",
      });
      return;
    }

    try {
      setLoading(true);
      const payloadUpdate = {
        DocEntry: modalActualizar.doc.DocEntry,
        ItemCode: modalActualizar.item.ItemCode,
        Price: parseFloat(price),
        Quantity: parseFloat(quantity),
      };
      const resUpdate = await axios.post(
        `${BASE_URL}/sap/actualizar_pedido`,
        payloadUpdate
      );


      if (resUpdate.data.status !== "ok")
        throw new Error(resUpdate.data.mensaje || "Error al actualizar pedido.");

      const payloadEntrada = { DocEntry: modalActualizar.doc.DocEntry };
      const resEntrada = await axios.post(
        `${BASE_URL}/sap/convertir_a_entrada_directa`,
        payloadEntrada
      );


      if (resEntrada.data.status === "ok") {
        setSnackbar({
          open: true,
          type: "success",
          message: resEntrada.data.mensaje || "Entrada creada correctamente.",
        });
        setModalActualizar({ open: false, doc: null, item: null });
        setTimeout(() => window.location.reload(), 2000);
      } else throw new Error(resEntrada.data.mensaje);
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        type: "error",
        message: "Error al actualizar y crear entrada.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="request-user-dashboard-container">
      <h2 className="request-user-dashboard-title">🏗️ Dashboard de Bodega</h2>
      <p className="request-user-dashboard-subtitle">
        Visualiza y gestiona tus Pedidos y Entradas de Mercancía desde SAP.
      </p>

      {/* === Filtros === */}
      <div className="filter-card">
        <div className="filter-grid">
          <input
            type="text"
            placeholder="Buscar por número, proveedor o RUT..."
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

          <Button
            variant="contained"
            color="error"
            onClick={() => window.open(`${BASE_URL}/export_facturas`, "_blank")}
          >
            ⬇ Exportar Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <CircularProgress />
          <p>Cargando datos desde SAP...</p>
        </div>
      ) : (
        <>
          <h2>📦 Pedidos</h2>
          {pedidosFiltrados.length === 0 ? (
            <p>No se encontraron pedidos abiertos.</p>
          ) : (
            <div className="request-user-cards-grid">
              {pedidosPagina.map((p) => {
                const almacenCode = normalizarAlmacen(p.Lineas?.[0]?.WarehouseCode);
                const infoAlmacen =
                  almacenesInfo[almacenCode] || { nombre: almacenCode, color: "#9ca3af" };

                return (
                  <div key={p.DocNum} className="request-user-card approved2">
                    <div className="request-user-card-header">
                      <div className="header-left">
                        <span className="request-user-id">
                          N° Pedido: <b>{p.DocNum}</b> | S° SAP:
                          <b>{p.NUMERO_SOLICITUD_SAP}</b>
                        </span>
                      </div>
                      <span
                        className="warehouse-badge"
                        style={{ background: infoAlmacen.color }}
                      >
                        {infoAlmacen.nombre}
                      </span>
                    </div>

                    <div className="request-user-card-body">
                      <p><b>Proveedor:</b> {p.CardName}</p>
                      <p><b>RUT:</b> {p.CardCode}</p>
                      <p><b>Fecha de Ingreso:</b> {formatearFecha(p.DocDate)}</p>
                      <p><b>Fecha de Vencimiento:</b> {formatearFecha(p.DocDueDate)}</p>
                      <hr />
                      {p.Lineas?.map((l, j) => (
                        <div key={j}>
                          <p><b>Artículo:</b> {l.ItemDescription}</p>
                          <p><b>Almacén:</b> {l.WarehouseCode}</p>
                          <p><b>Cantidad:</b> {l.Quantity} L</p>
                          {j !== p.Lineas.length - 1 && <hr />}
                        </div>
                      ))}
                    </div>

                    <div className="request-user-card-footer">
                      <button className="btn-detail" onClick={() => verDetalle(p, "pedido")}>
                        Ver Detalle
                      </button>
                      <button
                        className="btn-approve"
                        onClick={() => abrirActualizar(p, p.Lineas?.[0])}
                      >
                        Entrada Mercancía
                      </button>
                      <button className="btn-detail" onClick={() => verPdf(p)}>
                        Ver PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPagPedidos > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary"
                disabled={paginaPedidos === 1}
                onClick={() => setPaginaPedidos(paginaPedidos - 1)}
              >
                ← Anterior
              </button>
              <span>
                Página {paginaPedidos} de {totalPagPedidos}
              </span>
              <button
                className="btn-secondary"
                disabled={paginaPedidos === totalPagPedidos}
                onClick={() => setPaginaPedidos(paginaPedidos + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}

          <h2 style={{ marginTop: "40px" }}>📥 Entradas de Mercancía</h2>
          {entradasFiltradas.length === 0 ? (
            <p>No se encontraron entradas abiertas.</p>
          ) : (
            <div className="request-user-cards-grid">
              {entradasPagina.map((p) => {
                const almacenCode = normalizarAlmacen(p.Lineas?.[0]?.WarehouseCode);
                const infoAlmacen =
                  almacenesInfo[almacenCode] || { nombre: almacenCode, color: "#9ca3af" };

                return (
                  <div key={p.DocNum} className="request-user-card approved">
                    <div className="request-user-card-header">
                      <div className="header-left">
                        <span className="request-user-id">
                          N° Entrada: <b>{p.DocNum}</b>
                        </span>
                      </div>
                      <span
                        className="warehouse-badge"
                        style={{ background: infoAlmacen.color }}
                      >
                        {infoAlmacen.nombre}
                      </span>
                    </div>

                    <div className="request-user-card-body">
                      <hr />
                      <p><b>N° Factura:</b> {p.NUMERO_FACTURA}</p>
                      <p><b>N° Solicitud SAP:</b> {p.NUMERO_SOLICITUD_SAP}</p>
                      <p><b>N° Pedido:</b> {p.NUMERO_PEDIDO}</p>
                      <hr />
                      <p><b>Proveedor:</b> {p.CardName}</p>
                      <p><b>RUT:</b> {p.CardCode}</p>
                      <p><b>Fecha de Ingreso:</b> {formatearFecha(p.DocDate)}</p>                      
                      <p><b>Fecha de Vencimiento:</b> {formatearFecha(p.DocDueDate)}</p>
                      <p><b>Fecha de Documento:</b> {formatearFecha(p.FECHA_EMISION)}</p>
                      <hr />
                      {p.Lineas?.map((l, j) => (
                        <div key={j}>
                          <p><b>Artículo:</b> {l.ItemDescription}</p>
                          <p><b>Almacén:</b> {l.WarehouseCode}</p>
                          <p><b>Cantidad:</b> {l.Quantity} L</p>
                          {j < p.Lineas.length - 1 && <hr />}
                        </div>
                      ))}
                    </div>

                    <div className="request-user-card-footer">
                      <button className="btn-detail" onClick={() => verDetalle(p, "entrada")}>
                        Ver Detalle
                      </button>
                      <button className="btn-detail" onClick={() => verPdf(p)}>
                        Ver PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPagEntradas > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary"
                disabled={paginaEntradas === 1}
                onClick={() => setPaginaEntradas(paginaEntradas - 1)}
              >
                ← Anterior
              </button>
              <span>
                Página {paginaEntradas} de {totalPagEntradas}
              </span>
              <button
                className="btn-secondary"
                disabled={paginaEntradas === totalPagEntradas}
                onClick={() => setPaginaEntradas(paginaEntradas + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}

          {modalDetalle.open && (
            <div
              className="request-user-modal"
              onClick={(e) => {
                if (e.target.classList.contains("request-user-modal"))
                  setModalDetalle({ open: false, doc: null, tipo: null });
              }}
            >
              <div className="request-user-modal-content">
                <button
                  className="request-user-modal-close"
                  onClick={() => setModalDetalle({ open: false, doc: null, tipo: null })}
                >
                  ✖
                </button>
                <h2>
                  Detalles de {modalDetalle.tipo === "pedido" ? "Pedido" : "Entrada"} #{modalDetalle.doc?.DocNum}
                </h2>
                <hr />
                <p><b>Proveedor:</b> {modalDetalle.doc?.CardName}</p>
                <p><b>RUT:</b> {modalDetalle.doc?.CardCode}</p>
                <p><b>Fecha de Ingreso:</b> {formatearFecha(modalDetalle.doc?.DocDate)}</p>
                <p><b>Fecha de Vencimiento:</b> {formatearFecha(modalDetalle.doc?.DocDueDate)}</p>
                <p><b>Comentarios:</b> {modalDetalle.doc?.Comentarios}</p>
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
                          <td>
                            {e.LITROS_ASIGNADOS
                              ? `${e.LITROS_ASIGNADOS.toLocaleString("es-CL")} L`
                              : "—"}
                          </td>
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

                <h4 style={{ marginTop: "20px" }}>Impuestos Unitarios</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Precio Base</th>
                      <th>IEV</th>
                      <th>IEF</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{estanques[0]?.PBASE_SI_U ?? "—"}</td>
                      <td>{estanques[0]?.IEV_U ?? "—"}</td>
                      <td>{estanques[0]?.IEF_U ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>

                {modalDetalle.tipo === "entrada" &&
                  Array.isArray(estanques) &&
                  estanques.length > 0 && (
                    <>
                      <h4 style={{ marginTop: "20px" }}>Impuestos Totales</h4>
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
                            <td>{formatoCLP(factura?.BASE_AFECTA)}</td>
                            <td>{formatoCLP(factura?.IVA)}</td>
                            <td>{formatoCLP(factura?.IEV)}</td>
                            <td>{formatoCLP(factura?.IEF)}</td>
                            <td>{formatoCLP(factura?.TOTAL)}</td>
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
                <button className="request-user-modal-close" onClick={() => setModalActualizar({ open: false, doc: null, item: null })}>
                  ✖
                </button>
                <h3>
                  Ingresa el valor del artículo para el Pedido #{modalActualizar.doc.DocNum}
                </h3>
                <p className="request-user-dashboard-subtitle">
                  Confirma el valor unitario y la cantidad para crear la entrada de mercancías.
                </p>
                <p><b>Artículo:</b> {modalActualizar.item?.ItemDescription}</p>
                <p><b>Almacén:</b> {modalActualizar.item?.WarehouseCode}</p>
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
                <button
                  className="btn-approve"
                  style={{ marginTop: 15 }}
                  onClick={guardarActualizacion}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          )}

          {modalPdf.open && (
            <div className="request-user-modal">
              <div className="request-user-modal-content" style={{ width: "85%", height: "85%" }}>
                <button className="request-user-modal-close" onClick={() => setModalPdf({ open: false, url: null })}>
                  ✖
                </button>
                {modalPdf.url ? (
                  <iframe
                    src={modalPdf.url}
                    width="100%"
                    height="100%"
                    title="Vista PDF"
                    style={{ border: "none" }}
                  />
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
        </>
      )}
    </div>
  );
}