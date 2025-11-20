import React, { useEffect, useState } from "react";
import axios from "axios";
import { DataGrid } from "@mui/x-data-grid";
import { Button, CircularProgress, Box, Typography } from "@mui/material";
import "../../styles/request_dashboard.css";
import "../../styles/panel.css";

export default function RequestDashboardMaster() {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:5000/get_solicitudes_maestro");
        setRequests(res.data);
      } catch (err) {
        console.error("Error al obtener solicitudes:", err);
      }
    };
    fetchData();
  }, []);

  const handleAction = async (id, action) => {
    if (action === "RECHAZAR" && !comment.trim()) {
      alert("Debe ingresar un comentario para rechazar la solicitud.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:5000/update_solicitud_maestro", {
        id_solicitud: id,
        accion: action,
        comentario: comment,
      });

      alert(res.data.message);
      setSelected(null);
      setComment("");
      setRequests((prev) =>
        prev.map((r) =>
          r.id_solicitud === id
            ? { ...r, estado: action === "APROBAR" ? "Aprobado" : "Rechazado" }
            : r
        )
      );
    } catch (err) {
      console.error("Error al actualizar solicitud:", err);
      alert("Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { field: "numero_solicitud", headerName: "ID", width: 100 },
    { field: "nombre_solicitante", headerName: "Solicitante", flex: 1 },
    { field: "area", headerName: "Área", flex: 1 },
    { field: "detalle_solicitud", headerName: "Producto", flex: 1.5 },
    {
      field: "criticidad",
      headerName: "Criticidad",
      width: 130,
      renderCell: (params) => (
        <span
          className={`badge ${
            params.value === "Alta" ? "badge-red" : "badge-yellow"
          }`}
        >
          {params.value || "—"}
        </span>
      ),
    },
    { field: "fecha_solicitud", headerName: "Fecha", width: 140 },
    {
      field: "estado",
      headerName: "Estado",
      width: 130,
      renderCell: (params) => (
        <span
          className={`badge ${
            params.value === "Pendiente"
              ? "badge-yellow"
              : params.value === "Aprobado"
              ? "badge-green"
              : "badge-red"
          }`}
        >
          {params.value}
        </span>
      ),
    },
    {
      field: "acciones",
      headerName: "Acciones",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="contained"
          size="small"
          sx={{ backgroundColor: "#1b0808", textTransform: "none" }}
          onClick={() => setSelected(params.row)}
        >
          👁️ Ver
        </Button>
      ),
    },
  ];
  const rows = requests.map((r) => ({
    id: r.id_solicitud,
    ...r,
  }));

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">Dashboard de Solicitudes de Archivos Maestros</h2>
      <p className="dashboard-subtitle">
        Revise y autorice las solicitudes pendientes ({requests.length})
      </p>

      <div className="card" style={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[5, 10, 25]}
          disableRowSelectionOnClick
          sx={{
            border: "none",
            fontFamily: "Segoe UI",
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f1f5f9",
              color: "#0f172a",
              fontWeight: 600,
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "#f9fafb",
            },
          }}
        />
      </div>

      {selected && (
        <div className="modal">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setSelected(null)}>
              ✖
            </button>

            <h3>Detalle de Solicitud</h3>
            <p><b>N° Solicitud:</b> {selected.numero_solicitud}</p>
            <p><b>Fecha:</b> {selected.fecha_solicitud}</p>
            <p><b>Solicitante:</b> {selected.nombre_solicitante}</p>
            <p><b>Gerencia:</b> {selected.gerencia}</p>
            <p><b>Área:</b> {selected.area}</p>
            <p><b>Estado:</b> {selected.estado}</p>

            <hr />
            <h4>Datos del Producto</h4>
            <p><b>Detalle:</b> {selected.detalle_solicitud}</p>
            <p><b>Fabricación:</b> {selected.fabricacion}</p>
            <p><b>Tipo de material:</b> {selected.tipo_material}</p>
            <p><b>Grupo/Familia:</b> {selected.grupo_articulo}</p>
            <p><b>Tipo de reposición:</b> {selected.tipo_reposicion}</p>
            <p><b>Parte/Plano:</b> {selected.numero_parte_plano}</p>
            <p><b>Fabricante:</b> {selected.fabricante_marca}</p>
            <p><b>Precio:</b> {selected.precio_unitario}</p>
            <p><b>Unidad:</b> {selected.unidad_medida}</p>
            <p><b>Criticidad:</b> {selected.criticidad}</p>
            <p><b>Moneda:</b> {selected.moneda}</p>

            <textarea
              className="comment-box"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ingrese un comentario (obligatorio para rechazar)"
            ></textarea>

            <div className="modal-buttons">
              <button
                className="btn-approve"
                onClick={() => handleAction(selected.id_solicitud, "APROBAR")}
                disabled={loading}
              >
                {loading ? <CircularProgress size={16} color="inherit" /> : "✅ Aprobar"}
              </button>
              <button
                className="btn-reject"
                onClick={() => handleAction(selected.id_solicitud, "RECHAZAR")}
                disabled={loading}
              >
                {loading ? <CircularProgress size={16} color="inherit" /> : "❌ Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
