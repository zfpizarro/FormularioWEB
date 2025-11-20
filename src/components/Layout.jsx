import React from "react";
import { useLocation } from "react-router-dom";
import TopBar from "./TopBar";

export default function Layout({ children }) {
  const location = useLocation();

  // rutas donde no se mostrará el TopBar
  const hideTopBar = ["/login"].includes(location.pathname);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {/* Renderiza el TopBar solo si no estamos en /login */}
      {!hideTopBar && <TopBar />}

      <div
        style={{
          display: "flex",
          flex: 1,
          marginTop: hideTopBar ? "0" : "64px", // evita el espacio superior si no hay topbar
        }}
      >
        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
