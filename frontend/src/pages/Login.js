import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || "Invalid credentials");
        return;
      }

      const data = await response.json();
      login(data.access_token);
      navigate("/dashboard");
    } catch (err) {
      setError("Cannot connect to server. Is the backend running?");
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit}>
        <h2>Farmer Login</h2>
        {error && <div className="login-error">{error}</div>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
