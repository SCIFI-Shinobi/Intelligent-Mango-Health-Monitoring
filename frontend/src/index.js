import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { SettingsProvider } from "./context/SettingsContext";

import { SocketProvider } from "./context/SocketContext";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <LanguageProvider>
      <AuthProvider>
        <SocketProvider>
          <SettingsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          </SettingsProvider>
        </SocketProvider>
      </AuthProvider>
  </LanguageProvider>
);
