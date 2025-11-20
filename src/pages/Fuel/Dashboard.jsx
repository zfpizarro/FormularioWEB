import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { DataGrid } from "@mui/x-data-grid";
import {
  TextField,
  Button,
  Box,
  Typography,
  Select,
  MenuItem,
} from "@mui/material";
import "/src/styles/panel.css";
import api from "../../config/axiosInstance";
import BASE_URL from "../../config/apiConfig";


export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [vistaActiva, setVistaActiva] = useState("facturas");
  const [filtro, setFiltro] = useState("");

  const fetchData = async () => {
    try {
      const [logsRes, factRes] = await Promise.all([
        api.get("/logs"),
        api.get("/facturas"),
      ]);
      setLogs(logsRes.data);
setFacturas(factRes.data);

    } catch (err) {
      console.error("Error al obtener datos:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  //MÉTRICAS
  const estadoCount = useMemo(() => {
    const count = { ACEPTADO: 0, RECHAZADO: 0, ACTUALIZADO: 0, SAP_OK: 0 };
    logs.forEach((l) => {
      const estado = l.ESTADO?.trim().toUpperCase();
      if (estado === "ACTUALIZADA" || estado === "ACTUALIZADO") count.ACTUALIZADO++;
      else if (estado in count) count[estado]++;
    });
    return count;
  }, [logs]);

  const totalFacturas = facturas.length;
  const { ACEPTADO, RECHAZADO, ACTUALIZADO, SAP_OK } = estadoCount;
  const tasaAprobacion = totalFacturas
    ? ((SAP_OK / totalFacturas) * 100).toFixed(1)
    : 0;

  //DATOS GRÁFICOS
  const errores = useMemo(() => {
    const acc = {};
    logs
      .filter((l) => l.ESTADO?.trim().toUpperCase() === "RECHAZADO")
      .forEach((l) => {
        acc[l.COMENTARIO] = (acc[l.COMENTARIO] || 0) + 1;
      });
    return Object.entries(acc).map(([name, cantidad]) => ({ name, cantidad }));
  }, [logs]);





  const pieData = useMemo(
    () => [
      { name: "Aprobadas", value: ACEPTADO, color: "#22c55e" },
      { name: "Rechazadas", value: RECHAZADO, color: "#ef4444" },
      { name: "Actualizadas", value: ACTUALIZADO, color: "#3b82f6" },
      { name: "Ingreso en SAP", value: SAP_OK, color: "#4ada12ff" },
    ],
    [ACEPTADO, RECHAZADO, ACTUALIZADO, SAP_OK]
  );

  //COLUMNAS MUI
  const facturasColumns = [
    { field: "ID_FACTURA", headerName: "ID", width: 90 },
    { field: "NUMERO_FACTURA", headerName: "N° Factura", width: 140 },
    { field: "NUMERO_SOLICITUD_SAP", headerName: "Solicitud SAP", width: 140 },
    { field: "FECHA_EMISION", headerName: "Fecha", width: 130 },
    { field: "NOMBRE_EMISOR", headerName: "Emisor", width: 160 },
    { field: "NOMBRE_RECEPTOR", headerName: "Receptor", width: 160 },
    {
      field: "PDF_FILENAME",
      headerName: "Acciones",
      width: 140,
      sortable: false,
      renderCell: (params) =>
        params.value ? (
          <button
            className="btn-dark"
            onClick={() =>
              setSelectedPdf(`${BASE_URL}/uploads/${params.value}`)

            }
          >
            Ver PDF
          </button>
        ) : (
          "No disponible"
        ),
    },
  ];

  const logsColumns = [
    { field: "ID_LOGS", headerName: "ID", width: 90 },
    { field: "ID_FACTURA", headerName: "Factura", width: 100 },
    { field: "FECHA", headerName: "Fecha", width: 130 },
    { field: "HORA", headerName: "Hora", width: 110 },
    {
      field: "ESTADO",
      headerName: "Estado",
      width: 140,
      renderCell: (params) => {
        const estado = params.value?.trim().toUpperCase();
        const color =
          estado === "ACEPTADO"
            ? "#22c55e"
            : estado === "ACTUALIZADO" || estado === "ACTUALIZADA"
            ? "#3b82f6"
            : "#ef4444";
        return <span style={{ color, fontWeight: "bold" }}>{estado}</span>;
      },
    },
    { field: "COMENTARIO", headerName: "Comentario", flex: 1 },
  ];

  //FILTRO
  const dataFiltrada =
    vistaActiva === "facturas"
      ? facturas.filter((f) =>
          Object.values(f).some((v) =>
            String(v).toLowerCase().includes(filtro.toLowerCase())
          )
        )
      : logs.filter((l) =>
          Object.values(l).some((v) =>
            String(v).toLowerCase().includes(filtro.toLowerCase())
          )
        );

  //RETURN
  return (
    <div className="dashboard-container">
      <div className="header">
        <h1 className="dashboard-title">Manejo de información</h1>
      </div>

      {/* === STATS === */}
      <div className="stats-grid">
        {[
          { title: "Solicitudes Ingresadas en SAP", val: SAP_OK, color: "green", text: `${tasaAprobacion}% del total` },
          { title: "Solicitudes Rechazadas", val: RECHAZADO, color: "red", text: `${(100 - tasaAprobacion).toFixed(1)}% del total` },
          { title: "Total de Facturas", val: totalFacturas, color: "gray", text: "Este mes" },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`}>
            <h2>{s.title}</h2>
            <p className="big">{s.val}</p>
            <span>{s.text}</span>
          </div>
        ))}
      </div>

      {/* === GRÁFICOS === */}
      <div className="charts-grid">
        <div className="chart-container">
          <h2>Errores más comunes</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={errores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h2>Distribución de Estados</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/*SELECTOR DE VISTA*/}
      <Box display="flex" justifyContent="center" alignItems="center" mt={4}>
        <Typography variant="body1" sx={{ mr: 2 }}>
          Seleccione vista:
        </Typography>
        <Select
          value={vistaActiva}
          onChange={(e) => setVistaActiva(e.target.value)}
          size="small"
          sx={{ backgroundColor: "white", minWidth: 220 }}
        >
          <MenuItem value="facturas">📄 Últimas Facturas</MenuItem>
          <MenuItem value="logs">🧾 Logs del Sistema</MenuItem>
        </Select>
      </Box>

      {/*TABLA*/}
      <Box
        sx={{
          height: 520,
          width: "60%",          
          maxWidth: "60vw",      
          mx: "auto",
          mt: 3,
          backgroundColor: "#fff",
          borderRadius: 3,
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
          p: 2,
        }}
      >

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {vistaActiva === "facturas" ? "Últimas Facturas" : "Logs del Sistema"}
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <TextField
              size="small"
              placeholder="Buscar..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            {vistaActiva === "facturas" && (
              <Button
                variant="contained"
                color="error"
                onClick={() =>
                  window.open(`${BASE_URL}/export_facturas`, "_blank")
                }
              >
                Exportar
              </Button>
            )}
          </Box>
        </Box>

        <DataGrid
          rows={dataFiltrada}
          columns={vistaActiva === "facturas" ? facturasColumns : logsColumns}
          getRowId={(r) =>
            vistaActiva === "facturas" ? r.ID_FACTURA : r.ID_LOGS
          }
          pageSizeOptions={[7]}
          initialState={{
            pagination: { paginationModel: { pageSize: 7, page: 0 } },
          }}
          disableRowSelectionOnClick
          sx={{
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f1f5f9",
              fontWeight: "bold",
            },
            "& .MuiDataGrid-cell": {
              fontSize: "0.9rem",
            },
          }}
        />
      </Box>

      {selectedPdf && (
        <div className="pdf-modal">
          <div className="pdf-modal-content">
            <button className="btn btn-close" onClick={() => setSelectedPdf(null)}>
              ✖
            </button>
            <iframe
              src={selectedPdf}
              width="100%"
              height="900px"
              style={{ border: "1px solid #ccc" }}
              title="Factura PDF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
