import React, { useEffect, useState, useRef, useContext } from "react";
import "../App.css";
import StabilityChart from "../components/StabilityChart";
import { exportToCSV } from "../utils/exportCSV";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [data, setData] = useState({
    temperature: 0,
    humidity: 0,
    moisture: 0,
    health: "OPTIMAL",
    stabilityHistory: [],
    recommendations: []
  });
  const [connected, setConnected] = useState(false);

  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const connectWebSocket = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(`ws://localhost:8000/ws?token=${token}`);

    ws.current.onopen = () => setConnected(true);

    ws.current.onmessage = (event) => {
      const incoming = JSON.parse(event.data);
      setData(prev => ({
        ...prev,
        ...incoming,
        stabilityHistory: [
          ...prev.stabilityHistory.slice(-6),
          incoming.stability
        ]
      }));
    };

    ws.current.onerror = () => {
      console.log("WebSocket error");
    };

    ws.current.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connectWebSocket, 3000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const runScan = async () => {
    await fetch("http://localhost:8000/run-scan", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  };

  const exportData = () => {
    exportToCSV(data.stabilityHistory);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const healthColor =
    data.health === "OPTIMAL"
      ? "green"
      : data.health === "WARNING"
      ? "orange"
      : "red";

  return (
    <div className="dashboard">
      {/* Top Navigation Bar */}
      <div className="navbar">
        <div className="navbar-left">
          <span className="app-title">BASEY</span>
          <input className="search-bar" placeholder="Search BASEY insights..." />
        </div>
        <div className="navbar-right">
          {!connected && <span style={{color: "#ef4444", fontSize: 13, alignSelf: "center"}}>Reconnecting...</span>}
          <button className="icon-btn"><i className="fa-solid fa-bell"></i></button>
          <button className="icon-btn"><i className="fa-solid fa-user"></i></button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="breadcrumb">BASEY Terminal &gt; <span className="active">Live Monitoring</span></div>

      {/* Header */}
      <div className="header">
        <div></div>
        <div className="header-buttons">
          <button className="primary-btn" onClick={runScan}>
            Run BASEY Scan
          </button>
          <button className="secondary-btn" onClick={exportData}>
            Export Data
          </button>
          <button className="secondary-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="top-grid">
        <div className="metric-card temp">
          <div className="card-header">
            <span className="icon temp-icon" />
            <span>Temperature</span>
          </div>
          <div className="card-value">
            <span className="main-value">{data.temperature}°C</span>
          </div>
        </div>

        <div className="metric-card humidity">
          <div className="card-header">
            <span className="icon humidity-icon" />
            <span>Humidity</span>
          </div>
          <div className="card-value">
            <span className="main-value">{data.humidity}%</span>
          </div>
        </div>

        <div className="metric-card moisture">
          <div className="card-header">
            <span className="icon moisture-icon" />
            <span>Moisture</span>
          </div>
          <div className="card-value">
            <span className="main-value">{data.moisture}%</span>
          </div>
        </div>

        <div className={`health-card ${healthColor}`}>
          <div className="card-header">
            <span className="icon health-icon" />
            <span>BASEY Health Status</span>
          </div>
          <div className="card-value">
            <span className="main-value">{data.health}</span>
            <span className="integrity">SYSTEM INTEGRITY</span>
          </div>
        </div>
      </div>

      {/* Chart + Recommendations */}
      <div className="middle-grid">
        <div className="chart-container">
          <div className="section-header">
            <span>Historical Trends</span>
            <span className="section-title">BASEY Stability Index</span>
          </div>
          <StabilityChart data={data.stabilityHistory} />
        </div>

        <div className="recommendation-container">
          <div className="section-header">
            <span className="section-title">BASEY Recommendations</span>
            <span className="recommendation-count">{data.recommendations.length} New</span>
          </div>
          {data.recommendations.length === 0 && (
            <div className="recommendation-card">
              <span className="recommendation-title">No Alerts</span>
              <span className="recommendation-desc">Run a BASEY Scan or wait for sensor data.</span>
            </div>
          )}
          {data.recommendations.map((rec, index) => (
            <div key={index} className="recommendation-card">
              <span className="recommendation-title">{rec.title}</span>
              <span className="recommendation-desc">{rec.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Forecast */}
      <div className="forecast-section">
        <div className="section-header">
          <span className="section-title">BASEY Predictive Forecast</span>
        </div>
        <span className="forecast-desc">Next 5-day health projection generated by BASEY Intelligence.</span>
        <div className="forecast-bars">
          <div className="forecast-bar">
            <span className="forecast-label">TOMORROW</span>
            <div className="bar" style={{ height: "92%" }}>92%</div>
          </div>
          <div className="forecast-bar">
            <span className="forecast-label">DAY 2</span>
            <div className="bar" style={{ height: "96%" }}>96%</div>
          </div>
          <div className="forecast-bar">
            <span className="forecast-label">DAY 3</span>
            <div className="bar" style={{ height: "88%" }}>88%</div>
          </div>
          <div className="forecast-bar danger">
            <span className="forecast-label">DAY 4</span>
            <div className="bar" style={{ height: "72%" }}>72%</div>
          </div>
          <div className="forecast-bar">
            <span className="forecast-label">DAY 5</span>
            <div className="bar" style={{ height: "84%" }}>84%</div>
          </div>
        </div>
        <div className="forecast-legend">
          <span className="legend predicted">● Predicted</span>
          <span className="legend historical">● Historical Mean</span>
        </div>
      </div>

      <div className="footer">
        © 2024 BASEY Health Monitoring Systems. All proprietary data is encrypted and secure.
      </div>
    </div>
  );
}

export default Dashboard;
