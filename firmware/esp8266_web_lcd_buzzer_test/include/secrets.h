#ifndef SECRETS_H
#define SECRETS_H

// ==========================================
// ENVIRONMENT VARIABLES & CONFIGURATION
// ==========================================
// Copy this file to secrets.h and fill in your details.
// Make sure this file is ignored by git!

// Wi-Fi Credentials
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server Endpoints
// Use your Render/Vercel URLs for deployment
static const char* TEST_SERVER_URL = "https://mango-guard-backend.onrender.com/upload";
static const char* LOG_SERVER_URL = "http://localhost:4000"; // Dummy URL since you don't have a log server deployed


// Device Authentication
// Get this API key from your frontend dashboard Settings > Add Gateway
static const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";

#endif // SECRETS_H
