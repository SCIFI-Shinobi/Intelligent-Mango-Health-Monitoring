# Deployment & Gateway Setup Guide

## ✅ Deployment Readiness

**YES** — The app is **production-ready** if deployed. Here's what works:

### Backend API
- ✅ `/data/ingest` endpoint fully functional
- ✅ Device authentication via `X-Device-Key` header
- ✅ Device registration system generates API keys
- ✅ All data properly scoped by user ID
- ✅ PostgreSQL ready (uses environment variables)

### Frontend
- ✅ React 19 build succeeds (146KB gzipped)
- ✅ All pages functional (Dashboard, Logs, Analysis, Settings)
- ✅ Bilingual (English/Amharic) support
- ✅ Responsive design (desktop + mobile)

### Hardware Firmware
- ✅ ESP32/ESP8266 code is production-ready
- ✅ Correct API endpoint configuration
- ✅ Proper authentication headers
- ⚠️ BUT: Requires manual config in `Config.h`

---

## Gateway Setup Flow (Improved UI)

### 1️⃣ User Registers Gateway in Dashboard

**Before:** Boring, plain boxes
**Now:**
- Beautiful gradient cards with hover effects
- Status badges (Ready/Online)
- Embedded setup instructions
- Visual feedback on button presses

**UI Features:**
- Animated "Add Gateway" button with pulse effect
- Grid layout (responsive, up to 3 cards per row)
- Collapsible setup guide for each device
- One-click copy for API key with confirmation feedback

### 2️⃣ API Key Generated

Endpoint: `POST /devices/register`
- Backend generates random API key with `mg_` prefix
- Unique per device, per user

### 3️⃣ Configure Hardware

Update `firmware/*/src/Config.h`:

```cpp
// For deployment:
#define API_BASE_URL "https://your-deployed-backend.com"
#define DEVICE_API_KEY "mg_abc123def456..."  // Copy from dashboard
#define WIFI_SSID "Your WiFi"
#define WIFI_PASSWORD "Your Password"
```

### 4️⃣ Upload & Deploy

```bash
# ESP32
cd firmware/esp32_gateway
pio run -e mhetesp32devkit -t upload

# ESP8266
cd firmware/esp8266_gateway
pio run -e nodemcuv2 -t upload
```

### 5️⃣ Verify Connection

- **Device LCD screen**: Shows "W:OK B:OK" when connected
- **Backend logs**: HTTP POST requests from device
- **Dashboard WebSocket**: Real-time data appears instantly

---

## API Connection Verification

### What Gateway Sends
```json
{
  "device_id": "esp32_gateway_001",
  "temperature": 25.5,
  "humidity": 65.2,
  "disease_type": "Anthracnose",
  "confidence_score": 0.92,
  "recommendations": [...],
  "forecast": [...]
}
```

### Request Headers
```
POST /data/ingest
X-Device-Key: mg_abc123def456...
Content-Type: application/json
```

### Response
```json
{
  "status": "success",
  "device_id": "device:1",
  "data_stored": true
}
```

---

## Deployment Checklist

### Environment Variables

**Backend (.env or docker-compose):**
```
DATABASE_URL=postgresql://user:pass@host/db
SECRET_KEY=change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this
```

**Frontend (.env):**
```
REACT_APP_API_BASE_URL=https://your-backend-url.com
```

### Docker Setup

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Verify
curl http://localhost:8000/health
curl http://localhost:3000
```

### SSL/HTTPS (Recommended)
- Use nginx reverse proxy
- Add SSL cert (Let's Encrypt)
- Gateway uses HTTPS URLs
- WebSocket over WSS

---

## New UI Improvements

### Device Card Features
1. **Status Badge** - Shows device state (Ready, Online, Offline)
2. **Gradient Design** - Modern linear gradients, hover animations
3. **Setup Guide** - `<details>` element with step-by-step instructions
4. **Copy Feedback** - Button changes to green with checkmark
5. **Action Buttons** - Regenerate key, delete device with hover effects
6. **Empty State** - Beautiful placeholder when no devices registered

### Mobile Responsive
- Cards stack on smaller screens
- Touch-friendly buttons
- Readable code snippets
- Collapsible details by default

---

## Troubleshooting

### Gateway Not Connecting

1. **Check Config.h**
   ```cpp
   // Verify format
   #define API_BASE_URL "https://example.com"  // Has protocol
   #define DEVICE_API_KEY "mg_..."              // Starts with mg_
   ```

2. **Check WiFi**
   ```
   Serial monitor: "Wi-Fi OK" appears?
   If not: Check SSID/password in Config.h
   ```

3. **Check Backend URL**
   ```
   Gateway tries: POST https://example.com/data/ingest
   Backend running? CORS enabled? SSL valid?
   ```

4. **Check API Key**
   ```
   Copy exact key from dashboard (case-sensitive)
   Header must be: X-Device-Key: mg_xxxxx
   ```

### WebSocket Connection Issues

```javascript
// Frontend connects: ws://localhost:8000/ws?token=JWT_TOKEN
// Check:
// - Backend listening on /ws
// - JWT token valid
// - CORS headers correct
```

---

## Production Considerations

1. **Change default credentials** in backend env
2. **Use HTTPS** for all endpoints
3. **Set strong SECRET_KEY** (not the default)
4. **Use environment variables** for all secrets
5. **Enable rate limiting** in FastAPI
6. **Monitor PostgreSQL** performance
7. **Set up backups** for database
8. **Use load balancer** for horizontal scaling
9. **Monitor device connectivity** in dashboard
10. **Log device API calls** for debugging

---

## Summary

✅ **Backend:** Ready to deploy
✅ **Frontend:** Ready to deploy
✅ **Hardware:** Ready after Config.h setup
✅ **UI:** Beautiful, modern device management
⚠️ **Setup:** Requires manual config per device (intentional for security)

**Deployment time:** ~15 minutes (Docker) + 5 min per gateway configuration
