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
  const { token, user } = useContext(AuthContext);

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
