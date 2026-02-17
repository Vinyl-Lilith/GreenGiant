# Smart Greenhouse Backend

Production-ready Node.js + Express + MongoDB + Socket.IO backend for the Smart Greenhouse IoT system.

## Features

- **Authentication & Authorization** — JWT-based with role-based access (user, admin, head_admin)
- **Real-time Updates** — Socket.IO for live sensor data streaming
- **Forgot Password System** — Users can request password reset, admins approve
- **User Management** — Ban, restrict, promote, demote users
- **Activity Logging** — 24-hour log of all user actions
- **Data Export** — Excel file generation for any date
- **Threshold Management** — Live sync with Arduino via Raspberry Pi
- **Manual Control** — Direct actuator control with automation override
- **Offline Resilience** — Pi buffers data locally when backend is unreachable

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB (Atlas or local)
- **Real-time:** Socket.IO
- **Authentication:** JWT (jsonwebtoken)
- **Security:** Helmet, rate limiting, mongo-sanitize
- **Excel Export:** ExcelJS
- **Deployment:** Render.com (or any Node.js host)

---

## Installation

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd greenhouse_backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/greenhouse

# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-super-secret-key-here

# Must match the API_KEY in your Raspberry Pi's settings.py
PI_API_KEY=your-pi-api-key-here

# Comma-separated allowed origins
CORS_ORIGINS=https://yourfrontend.com,http://localhost:3000

# Optional: Pi's public URL (if you have port forwarding or ngrok)
PI_BASE_URL=http://<pi-ip>:5000
```

### 4. Run Development Server
```bash
npm run dev
```

Server starts on `http://localhost:10000`

---

## Deployment to Render.com

### 1. Create Account
Sign up at [render.com](https://render.com)

### 2. Create New Web Service
- Click **New +** → **Web Service**
- Connect your GitHub repository
- Select branch: `main` or `master`

### 3. Configure Build Settings
- **Name:** `greenhouse-backend`
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** Free (or Starter for production)

### 4. Add Environment Variables
In the Render dashboard, go to **Environment** tab and add:

```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
PI_API_KEY=...
CORS_ORIGINS=https://yourfrontend.onrender.com
NODE_ENV=production
```

### 5. Deploy
Click **Create Web Service**. Render will:
- Clone your repo
- Run `npm install`
- Start server with `npm start`
- Assign a URL like `https://greenhouse-backend-xyz.onrender.com`

### 6. Configure MongoDB Atlas
- Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Add Render's IP to Network Access (or allow `0.0.0.0/0` for simplicity)
- Create a database user
- Copy connection string to `MONGODB_URI` in Render

### 7. Update Raspberry Pi
Edit `/home/pi/Plants and stuff/greenhouse_pi/config/settings.py`:

```python
BACKEND_URL = "https://greenhouse-backend-xyz.onrender.com"
API_KEY     = "same-key-as-PI_API_KEY-in-render"
```

Restart the Pi service:
```bash
sudo systemctl restart greenhouse-pi
```

---

## API Endpoints

See **[API_DOCS.md](./API_DOCS.md)** for complete documentation.

**Quick Reference:**
- `POST /api/auth/register` — Sign up
- `POST /api/auth/login` — Login
- `GET /api/sensors/latest` — Latest reading
- `GET /api/sensors/24h` — 24-hour data
- `GET /api/thresholds` — Current thresholds
- `PUT /api/thresholds` — Update thresholds
- `POST /api/manual/control` — Manual actuator control
- `GET /api/admin/users` — All users (admin only)
- `GET /api/admin/activity/24h` — Activity log (admin only)

**WebSocket:** Connect to `wss://your-app.onrender.com` with JWT token

---

## Project Structure

```
greenhouse_backend/
├── server.js               ← Main entry point
├── package.json
├── .env.example
├── API_DOCS.md            ← Complete API reference
├── config/
│   └── database.js        ← MongoDB connection
├── models/
│   ├── User.js            ← User schema (auth, roles)
│   ├── Reading.js         ← Sensor readings
│   └── index.js           ← Event, ActivityLog, etc.
├── routes/
│   ├── auth.js            ← Login, signup, forgot password
│   ├── pi.js              ← Raspberry Pi data ingestion
│   ├── sensors.js         ← Get readings, charts, Excel
│   ├── thresholds.js      ← Get/set thresholds
│   ├── manual.js          ← Manual control
│   ├── admin.js           ← User management, logs
│   └── settings.js        ← User settings (theme, password)
└── middleware/
    └── auth.js            ← JWT verification, role checks
```

---

## Security

- **JWT Tokens:** 7-day expiry (configurable in `.env`)
- **Password Hashing:** bcrypt with salt rounds
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **Helmet:** Security headers
- **Mongo Sanitize:** Prevent NoSQL injection
- **CORS:** Restricted to configured origins
- **API Key:** Raspberry Pi endpoints require `X-API-Key` header

---

## First User Setup

The **first user** to register automatically becomes **head_admin**.

After deploying:
1. Navigate to your frontend
2. Click **Sign Up**
3. Create account → you are now head_admin
4. You can promote other users to admin via the Admin Panel

---

## Monitoring

### Logs (Render)
- Go to your service → **Logs** tab
- Real-time streaming logs
- Download for debugging

### Database (MongoDB Atlas)
- Go to Atlas dashboard
- **Metrics** → view storage, connections, operations

---

## Troubleshooting

### Backend won't start
- Check logs on Render
- Verify `MONGODB_URI` is correct
- Make sure all env vars are set

### Pi can't connect to backend
- Check `BACKEND_URL` in Pi's `settings.py`
- Verify `API_KEY` matches `PI_API_KEY`
- Check Pi's WiFi connection
- Test manually: `curl https://your-backend.onrender.com/api/health`

### WebSocket not connecting
- Make sure frontend uses `wss://` (not `ws://`)
- Check CORS settings
- Verify JWT token is valid

### Excel export fails
- Check if date parameter is in `YYYY-MM-DD` format
- Verify data exists for that date
- Check server logs for error details

---

## License

MIT

---

**Created by:** Your Name  
**Last Updated:** February 2026
