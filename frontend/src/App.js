import React, { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import Login from "./pages/Login";
import MainLayout from "./components/MainLayout";
import Home from "./pages/Home";
import AnalysisPage from "./pages/AnalysisPage";
import LogsPage from "./pages/LogsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import { AdminRoute } from "./components/AdminRoute";
import "./App.css";

function App() {
  const { token, user, userLoading } = useContext(AuthContext);

  if (token && userLoading) {
    return (
      <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 30, marginBottom: 15, color: '#2f81f7' }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#8b949e' }}>Initializing session...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={token ? <Navigate to={user?.username === 'admin' ? "/admin" : "/dashboard"} /> : <Login />}
      />
      
      {/* Protected Routes */}
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Home />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/user" element={<ProfilePage />} />
        <Route path="/profile" element={<Navigate to="/user" />} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
