#ifndef SECRETS_H
#define SECRETS_H

// ==========================================
// ENVIRONMENT VARIABLES & CONFIGURATION
// ==========================================
// Copy this file to secrets.h and fill in your details.
// Make sure this file is ignored by git!

// Wi-Fi Credentials
static const char* WIFI_SSID = "BDU-Guest";
static const char* WIFI_PASSWORD = "";

// Server Endpoints
// Use your Render/Vercel URLs for deployment
static const char* TEST_SERVER_URL = "https://mango-guard-backend.onrender.com/upload";
static const char* LOG_SERVER_URL = "http://localhost:4000"; // Dummy URL since you don't have a log server deployed



// Device Authentication
// Get this API key from your frontend dashboard Settings > Add Gateway
static const char* DEVICE_API_KEY = "mg_4b67afb3534185d19aa2680575a4ae0649ab591cfb26a321";

#endif // SECRETS_H
