import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./pages/System/ProtectedRoute";
import TopBar from "./components/TopBar";
import Layout from "./components/Layout";

// === PÁGINAS PRINCIPALES ===
import FuelDistributionPage from "./pages/Fuel/FuelDistributionPage";
import Dashboard from "./pages/Fuel/Dashboard";
import DashboardGoodsEntry from "./pages/Fuel/DashboardGoodsEntry";
import DashboardBuyers from "./pages/Fuel/DashboardBuyers";
import DashboardBuyersWithOutSAP from "./pages/Fuel/DashboardBuyersWithOutSAP";

// === MÓDULOS DE ARCHIVO MAESTRO ===
import RequestMaster from "./pages/File_Master/Request_master";
import Request_Items from "./pages/File_Master/Request_items";
import Request_SN from "./pages/File_Master/Request_SN";
import Request_AJ from "./pages/File_Master/Request_AJ";
import Request_user_main from "./pages/ADMIN_SAP/Request_USER_MAIN";
import Request_dashboard from "./pages/File_Master/Request_dashboard";

// === ADMIN SAP ===
import Request_user_create from "./pages/ADMIN_SAP/Request_user_create";
import Request_user_update from "./pages/ADMIN_SAP/Request_user_update";
import Request_user_delete from "./pages/ADMIN_SAP/Request_user_delete";
import Request_dashboard_user from "./pages/ADMIN_SAP/Request_dashboard_user";
import UsersS from "./pages/System/Create_users_system";
import LoginCMSG from "./pages/System/LoginCMSG";

function AppContent() {
  const location = useLocation();
  const noTopBarRoutes = ["/login"];
  const showTopBar = !noTopBarRoutes.includes(location.pathname);

  return (
    <>
      {showTopBar && <TopBar />}
      <Routes>
        <Route path="/login" element={<LoginCMSG />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fuel_request"
          element={
            <ProtectedRoute requiredRoles={["BODEGA", "ADMIN_TI"]}>
              <FuelDistributionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard_buyers"
          element={
            <ProtectedRoute requiredRoles={["COMPRAS", "ADMIN_TI"]}>
              <DashboardBuyers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard_goodsentry"
          element={
            <ProtectedRoute requiredRoles={["BODEGA", "ADMIN_TI"]}>
              <DashboardGoodsEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard_buyers_without_sap"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI", "COMPRAS", "BODEGA"]}>
              <DashboardBuyersWithOutSAP />
            </ProtectedRoute>
          }
        />

        {/* === ARCHIVO MAESTRO === */}
        <Route
          path="/request_master"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <RequestMaster />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_items"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_Items />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_sn"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_SN />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_aj"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_AJ />
            </ProtectedRoute>
          }
        />


        <Route
          path="/request_user_create"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_user_create />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_user_delete"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_user_delete />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_user_update"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_user_update />
            </ProtectedRoute>
          }
        />


        <Route
          path="/request_user_main"
          element={
            <ProtectedRoute requiredRoles={["SOLICITANTE", "ADMIN_TI"]}>
              <Request_user_main />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_dashboard"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI", "FINANZAS"]}>
              <Request_dashboard />
            </ProtectedRoute>
          }
        />

        {/* === ADMIN SAP === */}
        <Route
          path="/request_user_create"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI"]}>
              <Request_user_create />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_user_update"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI"]}>
              <Request_user_update />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_user_delete"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI"]}>
              <Request_user_delete />
            </ProtectedRoute>
          }
        />
        <Route
          path="/request_user_dashboard"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI"]}>
              <Request_dashboard_user />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users_system"
          element={
            <ProtectedRoute requiredRoles={["ADMIN_TI"]}>
              <UsersS />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Layout>
      <AppContent />
    </Layout>
  );
}
