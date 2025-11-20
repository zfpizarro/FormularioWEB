import React, { useState, useEffect } from "react";
import "/src/styles/fuel-distribution.css";
import api from "../../config/axiosInstance";

export default function FuelPurchaseRequest() {
  const [file, setFile] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [form, setForm] = useState({
    solicitudSap: "",
    itemCode: "",
    descripcion: "",
    proveedor: "",
    fecha: "",
    cantidad: "",
    impuesto: "",
    almacen: "",
    precio_unitario: "",
    ocr_data: null,
    _archivo_pdf: "",
  });

const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  const [rows, setRows] = useState([{ id: generateUUID(), tank: "", liters: "" }]);

  const [estanques, setEstanques] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [loadingStage, setLoadingStage] = useState(""); 

// === Cargar estanques por almacén (funciona con BT / BL / BS y nombres) ===
useEffect(() => {
  if (!form.almacen) return;

  const alm = (form.almacen || "").toUpperCase();
  let bodega = null;

  // Compatibilidad con códigos del backend
  if (alm.includes("BOD_TAL") || alm.includes("TALCUNA")) bodega = "TALCUNA";
  if (alm.includes("BOD_LAM") || alm.includes("LAMBERT")) bodega = "LAMBERT";
  if (alm.includes("BOD_SAN") || alm.includes("SAN ANTONIO")) bodega = "SAN ANTONIO";

  if (!bodega) {
    console.warn("⚠️ No se detectó bodega válida desde almacén:", alm);
    return;
  }

  api
    .get(`/estanques_por_bodega`, { params: { bodega } })
    .then((res) => {
      setEstanques(res.data.estanques || []);
    })
    .catch((err) => {
      console.error("❌ Error obteniendo estanques:", err);
      setEstanques([]);
    });
}, [form.almacen]);



  // === Filas dinámicas ===
  const handleRowChange = (id, field, value) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handleDeleteRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  // === Subir archivo con progreso REAL ===
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setPdfPreview(URL.createObjectURL(selectedFile));
    setLoading(true);
    setUploadProgress(0);

    try {
      const data = new FormData();
      data.append("file", selectedFile);

      await api.post("/upload_temp", data, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });



      setUploadProgress(100);
      setMessage("✅ Archivo subido correctamente.");
    } catch (err) {
      console.error("❌ Error al guardar archivo:", err);
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

// === Procesar OCR con progreso real ===
const handleProcessOCR = async () => {
  if (!file) return setMessage("❌ Debes seleccionar un archivo PDF primero.");
  
  setLoading(true);
  setLoadingStage("Subiendo archivo para procesamiento OCR...");
  setUploadProgress(0);

  try {
    const data = new FormData();
    data.append("file", file);
    const res = await api.post("/upload", data, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        const uploadPercent = Math.round(
          (progressEvent.loaded * 50) / progressEvent.total
        );
        setUploadProgress(uploadPercent);
      },
    });

    setLoadingStage("Procesando OCR...");
    setUploadProgress(50);

    await new Promise(resolve => {
      let progress = 50;
      const interval = setInterval(() => {
        progress += 5;
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
        setUploadProgress(Math.min(progress, 100));
      }, 200);
    });

    // ❗ AHORA SÍ EXISTE `res.data`
    const r = res.data;

    if (r.status === "rechazado") {
      setMessage(`⚠️ ${r.mensaje}`);
      setLoading(false);
      return;
    }
    
    if (r.status !== "ok") {
      setMessage(`⚠️ Error: ${r.error || "Error desconocido"}`);
      setLoading(false);
      return;
    }

    setForm({
      solicitudSap: r.solicitud_sap || "",
      itemCode: r.item_code || "",
      descripcion: r.descripcion || "",
      proveedor: `${r.sap_vendor_code || ""} - ${r.sap_vendor_name || ""}`,
      fecha: r.ocr_data?.Factura?.FECHA_EMISION || new Date().toISOString().split("T")[0],
      cantidad: r.litros || "",
      impuesto: r.tax_code || "FUEL",
      almacen: r.sap_whs_name || "",
      precio_unitario: r.precio_unitario || "",
      ocr_data: r,
      _archivo_pdf: r.archivo_pdf || "",
    });

    setUploadProgress(100);
  } catch (err) {
    console.error("❌ Error OCR:", err);
    setMessage("❌ Error al procesar el OCR.");
  } finally {
    setTimeout(() => {
      setLoading(false);
      setLoadingStage("");
      setUploadProgress(0);
    }, 500);
  }
};

  const validarDatos = () => {
    if (!form.ocr_data) return "Debes procesar una factura con OCR.";
    if (!form.itemCode) return "El número de artículo (ItemCode) es obligatorio.";
    if (!form.proveedor) return "Debe haber un proveedor válido.";
    if (!form.almacen) return "Falta seleccionar almacén.";
    if (!form.cantidad || form.cantidad <= 0) return "Cantidad inválida.";
    if (!form.precio_unitario || form.precio_unitario <= 0) return "Precio unitario inválido.";
    if (!form.impuesto) return "Tipo de impuesto faltante.";

    let totalDistribuido = 0;
    for (const dist of rows) {
      if (!dist.tank) return "Hay filas sin estanque asignado.";
      if (!dist.liters || dist.liters <= 0) return "Los litros deben ser mayores a 0.";
      totalDistribuido += dist.liters;
    }

    const diff = Math.abs(totalDistribuido - parseFloat(form.cantidad || 0));
    if (diff > 0.01) {
      return `La suma distribuida (${totalDistribuido}) no coincide con la cantidad total (${form.cantidad}).`;
    }
    return null;
  };

  const handleSendAll = async () => {
    const error = validarDatos();
    if (error) return setMessage(`⚠️ ${error}`);

    setLoading(true);
    setUploadProgress(0);
    setLoadingStage("Preparando datos para SAP...");

    try {
      // Paso 1: Crear solicitud en SAP (0-50%)
      setLoadingStage("Creando solicitud de compra en SAP...");
      const payloadSAP = {
        DocDate: new Date().toISOString().split("T")[0],
        DocDueDate: new Date().toISOString().split("T")[0],
        Requester: "Compras Combustible",
        Comments: `Solicitud automática desde OCR (${form.solicitudSap})`,
        DocumentLines: [
          {
            ItemCode: form.itemCode,
            Quantity: parseFloat(form.cantidad || 0),
            Price: parseFloat(form.precio_unitario || 0),
            TaxCode: form.impuesto,
            WarehouseCode: form.almacen,
            LineVendor: form.proveedor.split(" - ")[0],
            RequiredDate: form.fecha,
          },
        ],
        source_pdf: form._archivo_pdf || form.ocr_data?.archivo_pdf || null,
      };

      setUploadProgress(10);
      const resSAP = await api.post("/sap/crear_solicitud_compra", payloadSAP);
      
      setUploadProgress(50);
      
      if (resSAP.data.status !== "ok") {
        setMessage(`⚠️ Error SAP: ${resSAP.data.mensaje}`);
        setLoading(false);
        return;
      }

      const docNumSAP = resSAP.data.DocNum;
      setMessage(`✅ Solicitud SAP creada (DocNum: ${docNumSAP}). Registrando factura...`);

      // Paso 2: Registrar en BD (50-100%)
      setLoadingStage("Registrando factura en base de datos...");
      setUploadProgress(60);

      const payloadBD = {
        NUMERO_SOLICITUD_SAP: docNumSAP,
        Factura: form.ocr_data?.ocr_data?.Factura || form.ocr_data?.Factura || {},
        Distribuciones: rows,
      };

      setUploadProgress(70);
      const resBD = await api.post("/insert_factura", payloadBD);
      
      setUploadProgress(90);

      if (resBD.data.status === "ok") {
        setUploadProgress(100);
        setLoadingStage("¡Proceso completado exitosamente!");
        setMessage(`✅ Factura registrada en BD (Solicitud SAP ${docNumSAP}).`);
        
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      } else {
        setMessage(`⚠️ Error BD: ${resBD.data.error || resBD.data.mensaje}`);
      }
    } catch (err) {
      console.error("❌ Error general:", err);
      setMessage("❌ Error al procesar flujo SAP + BD.");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingStage("");
      }, 500);
    }
  };

  // === Estanques ya seleccionados ===
  const estanquesUsados = rows.map((r) => r.tank).filter(Boolean);

  return (
    <div className="fuel-page">
      <header className="page-header">
        <h1>Formulario de Distribución de Combustible</h1>
        <p>Sube tu factura, se procesará y generará la Solicitud de Compra en SAP</p>
      </header>

      {message && <div className="alert">{message}</div>}

      {/* === Subir PDF === */}
      <section className="card">
        <div className="card-header">📄 Subir factura</div>
        <input type="file" accept="application/pdf" onChange={handleFileSelect} disabled={loading} />
        {pdfPreview && (
          <iframe src={pdfPreview} width="100%" height="400px" style={{ marginTop: "10px" }}></iframe>
        )}
      </section>

      <div className="submit-wrap">
        <button onClick={handleProcessOCR} className="btn primary" disabled={loading || !file}>
          {loading ? "Procesando..." : "Procesar factura con OCR"}
        </button>
      </div>

      <br />

      {/* === Datos detectados === */}
      {form.itemCode && (
        <section className="card">
          <div className="card-header">📑 Datos detectados</div>
          <div className="grid-2">
            {[
              ["N° Solicitud SAP", form.solicitudSap],
              ["Número Artículo", form.itemCode],
              ["Nombre del Artículo", form.descripcion],
              ["Proveedor (RUT)", form.proveedor],
              ["Fecha de emisión del documento", form.fecha],
              ["Litros a distribuir", form.cantidad],
              ["Tipo de Impuesto", form.impuesto],
              ["Almacén", form.almacen],
              ["Precio Unitario", form.precio_unitario],
            ].map(([label, value], i) => (
              <React.Fragment key={i}>
                <label>{label}</label>
                <input value={value} readOnly />
              </React.Fragment>
            ))}
          </div>
        </section>
      )}

      {/* === Distribución === */}
      <section className="card">
        <div className="card-header">🛢️ Distribución de litros</div>
        {rows.map((row) => {
          // === Detectar ubicación según almacén ===
          const ubicacion = (() => {
            const alm = (form.almacen || "").toLowerCase();
            if (alm.includes("lambert")) return "LAMBERT";
            if (alm.includes("talcuna")) return "TALCUNA";
            if (alm.includes("antonio")) return "SAN ANTONIO";
            return null;
          })();

          // === Estanques filtrados dinámicamente ===
          const estanquesFiltrados = ubicacion
  ? estanques.filter((e) => {
      const usadoPorOtraFila = rows.some(
        (r) => r.id !== row.id && r.tank === String(e.id)
      );

      const ubicEst = (e.ubicacion || "").toUpperCase();

      return (
        ubicEst.includes(ubicacion) && !usadoPorOtraFila
      );
    })
  : [];
          return (
            <div key={row.id} className="table-row">
              <select
                value={row.tank}
                disabled={!ubicacion}
                onChange={(e) => handleRowChange(row.id, "tank", e.target.value)}
                style={{
                  border: !row.tank ? "1px solid red" : "1px solid #ccc",
                }}
              >
                <option value="">
                  {!ubicacion
                    ? "Debe procesar la factura"
                    : "Seleccionar estanque disponible"}
                </option>
                {estanquesFiltrados.map((est) => (
                  <option key={est.id} value={est.id}>
                    {`${est.nombre} (${est.ubicacion})`}
                  </option>
                ))}
              </select>

              <div className="td liters-cell">
                <input
                  className="input input-number"
                  type="number"
                  min="0"
                  step="1"
                  value={row.liters}
                  onChange={(e) =>
                    handleRowChange(row.id, "liters", Number(e.target.value))
                  }
                  placeholder="0"
                />
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => handleDeleteRow(row.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className="btn ghost"
          onClick={() => setRows([...rows, { id: generateUUID(), tank: "", liters: "" }])}
        >
          ＋ Añadir fila
        </button>
      </section>

      <div className="submit-wrap">
        <button onClick={handleSendAll} className="btn primary" disabled={loading || !form.itemCode}>
          {loading ? "Enviando..." : "🚀 Crear Solicitud de Compra"}
        </button>
      </div>

      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div style={{ 
            background: "rgba(255,255,255,0.1)", 
            padding: "40px", 
            borderRadius: "15px",
            backdropFilter: "blur(10px)",
            minWidth: "400px",
            textAlign: "center"
          }}>
            <h2 style={{ color: "#fff", marginBottom: 10 }}>
              {loadingStage || "Procesando..."}
            </h2>
            
            <div
              style={{
                width: "100%",
                background: "#333",
                borderRadius: "10px",
                overflow: "hidden",
                marginTop: "20px",
                height: "20px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${uploadProgress}%`,
                  backgroundColor: "#E87514",
                  transition: "width 0.3s ease-out",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {uploadProgress > 10 && `${uploadProgress}%`}
              </div>
            </div>
            
            <p style={{ color: "#ccc", marginTop: 15, fontSize: "14px" }}>
              {uploadProgress < 100
                ? `${uploadProgress}% completado`
                : "✓ Finalizando..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}