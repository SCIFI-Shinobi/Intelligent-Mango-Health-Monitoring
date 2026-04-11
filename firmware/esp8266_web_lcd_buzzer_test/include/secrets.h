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
// Use your Render/Vercel URLs for deployment, e.g., "https://your-backend.onrender.com/upload"
static const char* TEST_SERVER_URL = "http://10.161.119.162:8000/upload";
static const char* LOG_SERVER_URL = "http://10.161.119.162:4000"; // Can be left as is if not in use

// Device Authentication
// Get this API key from your frontend dashboard Settings > Add Gateway
static const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";

#endif // SECRETS_H
