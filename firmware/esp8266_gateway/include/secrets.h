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



// Device Authentication
// Get this API key from your frontend dashboard Settings > Add Gateway
static const char* DEVICE_API_KEY = "mg_c2a2bc944471a63f0ea2b5c9f4f432fc361172d5a76acd74";

#endif // SECRETS_H

// Disease simulation interval (ms) for random disease generation in main.cpp
#define DISEASE_SIM_INTERVAL_MS 20000

// Forecast simulation interval (ms) for random forecast generation in main.cpp
// Set to 86400000 (24h) for deployment, 20000 (20s) for demo
#define FORECAST_INTERVAL_MS 20000
