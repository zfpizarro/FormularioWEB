import React, { useState } from "react";
import "/src/styles/request_master.css";


export default function Request_SN() {
  const [formData, setFormData] = useState({
    nombreSolicitante: "",
    gerencia: "",
    fecha: "",
    area: "",
    detalleSolicitud: "",
    unidadMedida: "",
    fabricacion: "",
    tipoMaterial: "",
    grupoArticulo: "",
    criticidad: "",
    tipoReposicion: "",
    numeroParte: "",
    fabricante: "",
    consumo: "",
    precioUnitario: "",
    moneda: "",
    archivo: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData({
      ...formData,
      [name]: files ? files[0] : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Formulario enviado:", formData);
  };

  return (
    <div className="solicitud-container">
      <h1 className="titulo-principal">Solicitud Maestro de Socio de negocios</h1>

      <div className="solicitud-card">
        <form onSubmit={handleSubmit}>
          {/* Verificación de identidad */}
          <section>
            <h2>Verificación de Identidad</h2>
            <div className="grid-2">
              <div>
                <label>Nombre Solicitante</label>
                <input
                  type="text"
                  name="nombreSolicitante"
                  placeholder="Ingrese nombre"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Gerencia</label>
                <input
                  type="text"
                  name="gerencia"
                  placeholder="Ingrese gerencia"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Fecha</label>
                <input
                  type="date"
                  name="fecha"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Área</label>
                <input
                  type="text"
                  name="area"
                  placeholder="Ingrese área"
                  onChange={handleChange}
                />
              </div>
            </div>
          </section>
          <hr />
          {/* Campos de solicitud */}
          <section>
            <h2>Campos de Solicitud</h2>
            <div className="grid-2">
              <div>
                <label>Detalle solicitud (título del material)</label>
                <input
                  type="text"
                  name="detalleSolicitud"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Unidad de medida</label>
                <input
                  type="text"
                  name="unidadMedida"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Fabricación</label>
                <input
                  type="text"
                  name="fabricacion"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Tipo de material</label>
                <input
                  type="text"
                  name="tipoMaterial"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Grupo de artículo o Familia</label>
                <input
                  type="text"
                  name="grupoArticulo"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Criticidad</label>
                <input
                  type="text"
                  name="criticidad"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Tipo de reposición</label>
                <input
                  type="text"
                  name="tipoReposicion"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Número de parte o plano</label>
                <input
                  type="text"
                  name="numeroParte"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Fabricante o marca</label>
                <input
                  type="text"
                  name="fabricante"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Consumo estimado por mes</label>
                <input
                  type="text"
                  name="consumo"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>

              <div>
                <label>Precio unitario estimado</label>
                <input
                  type="text"
                  name="precioUnitario"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
              <div>
                <label>Moneda</label>
                <input
                  type="text"
                  name="moneda"
                  placeholder="Ingrese la información"
                  onChange={handleChange}
                />
              </div>
            </div>
          </section>

          <hr />

          <section>
            <h2>Cotización</h2>
            <label>Adjuntar documento</label>
            <input
              type="file"
              name="archivo"
              onChange={handleChange}
            />
          </section>

          <div className="button-container">
            <button type="submit">Enviar Solicitud</button>
          </div>
        </form>
      </div>
    </div>
  );
}
