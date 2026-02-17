# GREENHOUSE BACKEND API DOCUMENTATION
**Version:** 1.0.0  
**Base URL:** `https://your-app.onrender.com/api`  
**WebSocket URL:** `wss://your-app.onrender.com`

All authenticated endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

---

## AUTHENTICATION ENDPOINTS

### Register New User
`POST /auth/register`

**Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "theme": "light"
  }
}
```

**Note:** First user to register becomes `head_admin`.

---

### Login
`POST /auth/login`

**Body:**
```json
{
  "username": "john_doe",
  "password": "securepassword"
}
```

**Response:** Same as register

---

### Logout
`POST /auth/logout`  
**Auth Required:** Yes

---

### Get Current User
`GET /auth/me`  
**Auth Required:** Yes

---

### Forgot Password Request
`POST /auth/forgot-password`

**Body:**
```json
{
  "username": "john_doe",
  "message": "I forgot my password, please help!",
  "rememberedPassword": "oldpassword123"
}
```

**Note:** `rememberedPassword` is optional. If provided, admin can test if it matches.

---

### Change Password
`PUT /auth/change-password`  
**Auth Required:** Yes

**Body:**
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass"
}
```

---

## SENSOR DATA ENDPOINTS

### Get Latest Reading
`GET /sensors/latest`  
**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "temp": 26.5,
    "hum": 62.1,
    "soil1": 71.0,
    "soil2": 68.0,
    "npk": {
      "ok": true,
      "n": 45,
      "p": 32,
      "k": 60
    },
    "actuators": {
      "pump_water": false,
      "pump_nutrient": false,
      "fan_exhaust": true,
      "peltier_pwm": 150
    },
    "received_at": "2026-02-18T10:30:00.000Z"
  }
}
```

---

### Get 24-Hour Data
`GET /sensors/24h`  
**Auth Required:** Yes

Returns array of all readings in the last 24 hours.

---

### Get Data by Date
`GET /sensors/date/2026-02-18`  
**Auth Required:** Yes

Returns all readings for the specified date (YYYY-MM-DD format).

---

### Get Data Range
`GET /sensors/range?start=2026-02-01&end=2026-02-18`  
**Auth Required:** Yes

---

### Export to Excel
`GET /sensors/export/excel?date=2026-02-18`  
**Auth Required:** Yes

**Response:** Downloads an Excel file

---

### Get Automation Events (24h)
`GET /sensors/events/24h`  
**Auth Required:** Yes

Returns events like `pump_water_on`, `peltier_off`, etc.

---

## THRESHOLD MANAGEMENT

### Get Current Thresholds
`GET /thresholds`  
**Auth Required:** Yes

**Response:**
```json
{
  "success": true,
  "data": {
    "soil1": 60.0,
    "soil2": 60.0,
    "temp_high": 35.0,
    "temp_low": 15.0,
    "hum_high": 80.0,
    "hum_low": 30.0,
    "npk_n": 20,
    "npk_p": 20,
    "npk_k": 20,
    "lastUpdatedBy": "...",
    "lastSyncedWithArduino": "2026-02-18T10:00:00.000Z",
    "updatedAt": "2026-02-18T10:00:00.000Z"
  }
}
```

---

### Update Thresholds
`PUT /thresholds`  
**Auth Required:** Yes (write permission)

**Body:** (send only the fields you want to update)
```json
{
  "soil1": 75.0,
  "temp_high": 34.0,
  "npk_n": 25
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thresholds updated successfully",
  "data": { /* updated thresholds */ }
}
```

---

## MANUAL CONTROL

### Control Actuator
`POST /manual/control`  
**Auth Required:** Yes (write permission)

**Body:**
```json
{
  "actuator": "pump_water",
  "state": true,
  "pwm": 200
}
```

**Valid actuators:**
- `pump_water`
- `pump_nutrient`
- `fan_exhaust` (supports PWM 0-255)
- `peltier` (supports PWM 0-255)
- `fan_peltier_hot`
- `fan_peltier_cold`

**Note:** `pwm` is optional and only applies to `fan_exhaust` and `peltier`.

---

### Resume Automatic Mode
`POST /manual/auto`  
**Auth Required:** Yes (write permission)

Disables manual override and lets Arduino automation take over.

---

## ADMIN PANEL ENDPOINTS
All admin endpoints require `admin` or `head_admin` role.

### Get All Users
`GET /admin/users`  
**Auth Required:** Admin

---

### Get Online Users
`GET /admin/users/online`  
**Auth Required:** Admin

---

### Delete User
`DELETE /admin/users/:id`  
**Auth Required:** Admin

**Note:** Cannot delete head admin. Only head admin can delete other admins.

---

### Ban/Unban User
`PUT /admin/users/:id/ban`  
**Auth Required:** Admin

**Body:**
```json
{
  "banned": true
}
```

---

### Restrict User (View-Only)
`PUT /admin/users/:id/restrict`  
**Auth Required:** Admin

**Body:**
```json
{
  "restricted": true
}
```

---

### Promote User to Admin
`PUT /admin/users/:id/promote`  
**Auth Required:** Head Admin only

---

### Demote Admin to User
`PUT /admin/users/:id/demote`  
**Auth Required:** Head Admin only

---

### Get 24-Hour Activity Log
`GET /admin/activity/24h`  
**Auth Required:** Admin

Returns all user actions in the last 24 hours with details.

---

### Get Pending Password Reset Requests
`GET /admin/forgot-password/pending`  
**Auth Required:** Admin

---

### Approve Password Reset
`POST /admin/forgot-password/:id/approve`  
**Auth Required:** Admin

**Body:**
```json
{
  "newPassword": "newpass123"
}
```

---

### Reject Password Reset
`POST /admin/forgot-password/:id/reject`  
**Auth Required:** Admin

---

### Get System Alerts
`GET /admin/alerts`  
**Auth Required:** Admin

Returns alerts from Pi/Arduino (CRITICAL, ERROR, WARNING, INFO).

---

### Acknowledge Alert
`PUT /admin/alerts/:id/acknowledge`  
**Auth Required:** Admin

---

## USER SETTINGS

### Get Settings
`GET /settings`  
**Auth Required:** Yes

---

### Change Username
`PUT /settings/username`  
**Auth Required:** Yes (write permission)

**Body:**
```json
{
  "newUsername": "new_username"
}
```

---

### Change Theme
`PUT /settings/theme`  
**Auth Required:** Yes

**Body:**
```json
{
  "theme": "dark"
}
```

**Valid themes:** `light`, `dark`, `auto`

---

## WEBSOCKET EVENTS (Socket.IO)

Connect with JWT token:
```javascript
const socket = io('wss://your-app.onrender.com', {
  auth: {
    token: 'your_jwt_token_here'
  }
});
```

### Events Emitted by Server:

| Event | Description | Payload |
|-------|-------------|---------|
| `new_reading` | New sensor data arrived | Latest reading object |
| `automation_event` | Automation action (pump on/off, etc.) | Event object |
| `threshold_update` | Threshold changed by user | Updated thresholds |
| `manual_control` | User manually controlled actuator | Control details |
| `auto_mode_resumed` | Manual mode disabled | { resumedBy, timestamp } |
| `pi_status` | Pi heartbeat status | Status object |
| `system_alert` | Critical/error alert | Alert object |
| `user_online` | User logged in | { userId, username } |
| `user_offline` | User logged out | { userId, username } |
| `force_disconnect` | Account banned | { reason } |

### Events Listened by Server:

| Event | Description |
|-------|-------------|
| `request_live_data` | Request immediate sensor data push |

---

## RASPBERRY PI ENDPOINTS
**Auth:** API Key in `X-API-Key` header

### Batch Upload Readings
`POST /pi/readings`

**Body:**
```json
{
  "readings": [
    { /* reading 1 */ },
    { /* reading 2 */ }
  ]
}
```

---

### Batch Upload Events
`POST /pi/events`

---

### Pi Heartbeat
`POST /pi/heartbeat`

**Body:**
```json
{
  "arduino_connected": true,
  "backend_reachable": true,
  "wifi_available": true,
  "arduino_port": "/dev/ttyACM0",
  "webcam_device": "/dev/video0",
  "webcam_active": true,
  "pending_readings": 5
}
```

---

### System Alerts
`POST /pi/alerts`

**Body:**
```json
{
  "alerts": [
    {
      "level": "CRITICAL",
      "message": "Arduino unresponsive after 5 reboot attempts"
    }
  ]
}
```

---

## ERROR RESPONSES

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `400` — Bad Request (invalid data)
- `401` — Unauthorized (missing/invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not Found
- `500` — Server Error
- `503` — Service Unavailable (Pi offline)

---

## ROLE PERMISSIONS

| Role | Permissions |
|------|-------------|
| `user` | View data, change own settings |
| `admin` | All user permissions + user management + forgot password handling + activity logs |
| `head_admin` | All admin permissions + promote/demote admins |

**Account Status:**
- `active` — Full access
- `restricted` — View-only (cannot control actuators or change thresholds)
- `banned` — No access

---

## NOTIFICATIONS

The backend does NOT send email/SMS notifications directly.

Implement notifications in your frontend by:
1. Listening to WebSocket events
2. Using browser notifications API
3. Displaying in-app toast messages

Example:
```javascript
socket.on('system_alert', (alert) => {
  if (alert.level === 'CRITICAL') {
    showBrowserNotification(alert.message);
  }
});
```

---

## FRONTEND INTEGRATION CHECKLIST

### Homepage
- [ ] Connect to WebSocket and listen for `new_reading`
- [ ] Display live temp, humidity, soil, NPK
- [ ] Embed webcam stream (iframe to `http://<pi-ip>:8765/stream`)
- [ ] Double-click webcam to enlarge (modal)
- [ ] Fetch `/sensors/24h` for charts/graphs
- [ ] Date picker → fetch `/sensors/date/:date` → download Excel

### Logic Page
- [ ] Fetch `/thresholds` on load to show current values
- [ ] Input fields for each threshold (pre-filled with current)
- [ ] PUT `/thresholds` when user saves
- [ ] Listen to `threshold_update` WebSocket event

### Manual Page
- [ ] Toggle buttons for each actuator
- [ ] Sliders for PWM (fan_exhaust, peltier)
- [ ] POST `/manual/control` when user changes state
- [ ] "Resume Auto" button → POST `/manual/auto`
- [ ] Listen to `manual_control` event to update UI

### Admin Panel
- [ ] Fetch `/admin/users` and display table
- [ ] Fetch `/admin/users/online` for online indicator
- [ ] Delete/Ban/Restrict buttons → respective PUT/DELETE endpoints
- [ ] Promote/Demote (head admin only)
- [ ] Activity log → `/admin/activity/24h`
- [ ] Forgot password → `/admin/forgot-password/pending`
- [ ] Approve/Reject buttons

### Settings Page
- [ ] Display current username/email/theme
- [ ] Change username → PUT `/settings/username`
- [ ] Change password → PUT `/auth/change-password`
- [ ] Theme dropdown → PUT `/settings/theme`
- [ ] Apply theme to entire app (CSS class swap)

---

**End of API Documentation**
