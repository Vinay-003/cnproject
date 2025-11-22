# 🏗️ IoT Air Quality Monitoring System - Architecture Documentation

## Based on Research Paper Implementation

This document explains how our simulation maps to the research paper's architecture (Figures 1, 3, 4, 5, and 8).

---

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TIER 1: IoT SENSOR LAYER                           │
│                         (Simulated ESP8266 NodeMCU)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Hardware (Simulated):                                                      │
│   • NodeMCU ESP8266 (WiFi Module)                                          │
│   • MQ-135 Gas Sensor (CO2 detection)                                      │
│   • DHT11/DHT22 (Temperature & Humidity)                                   │
│                                                                             │
│  Script: simulator/nodemcu.js                                              │
│  Behavior:                                                                  │
│   1. Read sensor values every 10 seconds                                   │
│   2. Authenticate with Channel ID + Write API Key                          │
│   3. Send data via HTTP POST to server                                     │
│   4. Follows Fig 3 software flowchart exactly                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                            [WiFi Network]
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TIER 2: CLOUD SERVER LAYER                             │
│                    (Express.js Backend - Local Server)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│   • Authentication System (Fig 5: Register/Login)                          │
│   • Channel Management (Fig 8: Create/View/Delete channels)                │
│   • API Key Generation (Read & Write keys per channel)                     │
│   • JSON Database (stores users, channels, sensor readings)                │
│   • REST API Endpoints                                                      │
│                                                                             │
│  Files:                                                                     │
│   • backend/server.js    - Main API server                                 │
│   • backend/database.js  - Data persistence layer                          │
│                                                                             │
│  Endpoints:                                                                 │
│   POST /api/auth/register        - User registration                       │
│   POST /api/auth/login           - User login                              │
│   POST /api/channels/create      - Create channel (generates API keys)     │
│   GET  /api/channels/user/:id    - List user's channels                    │
│   POST /api/sensor-data          - Receive data from NodeMCU               │
│   GET  /api/channels/:id/readings - Fetch readings for mobile app          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                           [HTTP/REST API]
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIER 3: MOBILE APPLICATION LAYER                         │
│                      (React Native - Expo Go App)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Screens (Following Fig 5 Frontend Workflow):                              │
│   • Login Screen            (app/login.tsx)                                │
│   • Register Screen         (app/register.tsx)                             │
│   • Dashboard               (app/(tabs)/index.tsx)                         │
│     - Channel selection                                                     │
│     - Real-time air quality display                                        │
│     - AQI, CO2, Temperature, Humidity metrics                              │
│     - Trend charts and visualizations                                      │
│   • Create Channel Modal    (app/modal.tsx)                                │
│   • About/Info Screen       (app/(tabs)/explore.tsx)                       │
│                                                                             │
│  Features:                                                                  │
│   • User authentication with session management                            │
│   • Multi-channel support                                                  │
│   • Auto-refresh every 15 seconds                                          │
│   • Pull-to-refresh manual update                                          │
│   • Color-coded AQI status indicators                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow (As Per Research Paper)

### 1. NodeMCU to Cloud (Fig 3 Flow)

```
NodeMCU Simulator (simulator/nodemcu.js)
    ↓
[Read Sensors] - MQ135 (CO2), DHT11 (Temp/Humidity)
    ↓
[Check Internet Connection] - Ping server health endpoint
    ↓
[Validate Credentials] - Channel ID + Write API Key
    ↓
[Transfer Data to Cloud] - POST /api/sensor-data
    {
      channelId: "channel_xxx",
      writeApiKey: "api_key_xxx",
      co2: 485,
      temperature: 24.5,
      humidity: 52.3
    }
    ↓
Server receives & calculates AQI → Stores in database
```

### 2. Cloud to Mobile App (Fig 4 Flow)

```
Mobile App (React Native)
    ↓
[User Login] - POST /api/auth/login
    ↓
[Select Channel] - GET /api/channels/user/:userId
    ↓
[Fetch Latest Readings] - GET /api/channels/:channelId/readings?limit=50
    ↓
[Display Data] - AQI gauge, metrics cards, trend charts
    ↓
[Auto-refresh every 15s] - Polling for real-time updates
```

---

## 🗂️ Database Schema (JSON-based)

### Users Collection
```json
{
  "id": "user_1732342567890_a1b2c3d4",
  "username": "demo_user",
  "email": "demo@airquality.com",
  "password": "sha256_hash",
  "createdAt": "2025-11-22T10:30:00.000Z"
}
```

### Channels Collection (Fig 8 Structure)
```json
{
  "id": "channel_1732342567890_e5f6g7h8",
  "userId": "user_1732342567890_a1b2c3d4",
  "name": "Living Room Monitor",
  "description": "Air quality monitoring with MQ-135 and DHT11",
  "readApiKey": "abc123def456...",
  "writeApiKey": "xyz789uvw012...",
  "createdAt": "2025-11-22T10:35:00.000Z",
  "fields": {
    "field1": "AQI",
    "field2": "CO2",
    "field3": "Temperature",
    "field4": "Humidity"
  }
}
```

### Readings Collection
```json
{
  "id": "reading_1732342567890_i9j0k1l2",
  "channelId": "channel_1732342567890_e5f6g7h8",
  "timestamp": "2025-11-22T10:40:00.000Z",
  "aqi": 23,
  "co2": 485,
  "temperature": 24.5,
  "humidity": 52.3
}
```

---

## 🔐 Authentication & Security (Fig 5 & Fig 8)

### User Registration Flow (Fig 5)
```
1. User enters username, email, password
2. POST /api/auth/register
3. Server validates:
   - Email is unique
   - Password >= 6 characters
   - Username is unique
4. Hash password (SHA-256)
5. Create user record
6. Return user data (without password)
```

### Channel Creation Flow (Fig 8)
```
1. User clicks "Create Channel" (logged in)
2. Enter channel name and description
3. POST /api/channels/create with userId
4. Server validates user exists
5. Generate unique Channel ID
6. Generate Read API Key (32 hex chars)
7. Generate Write API Key (32 hex chars)
8. Store channel in database
9. Return channel with API keys
10. Display API keys to user (for NodeMCU configuration)
```

### API Key Authentication
```
Write Key: Used by NodeMCU to send sensor data
  - Validated on POST /api/sensor-data
  - Prevents unauthorized data injection

Read Key: Optional for mobile app
  - Can restrict who views channel data
  - Currently optional in our implementation
```

---

## 📡 API Endpoints Reference

### Authentication Endpoints
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/auth/register` | Register new user | `{username, email, password}` | `{user}` |
| POST | `/api/auth/login` | Login user | `{email, password}` | `{user}` |
| GET | `/api/auth/profile/:userId` | Get user profile | - | `{user}` |

### Channel Management Endpoints
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/channels/create` | Create new channel | `{userId, name, description}` | `{channel}` (with API keys) |
| GET | `/api/channels/user/:userId` | List user's channels | - | `{channels[]}` |
| GET | `/api/channels/:channelId` | Get channel details | - | `{channel}` |
| DELETE | `/api/channels/:channelId` | Delete channel | `{userId}` | `{message}` |

### Sensor Data Endpoints
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/sensor-data` | Receive sensor data from NodeMCU | `{channelId, writeApiKey, co2, temperature, humidity}` | `{reading}` (with calculated AQI) |
| GET | `/api/channels/:channelId/readings` | Get readings for channel | Query: `?limit=50&readApiKey=xxx` | `{readings[]}` |
| GET | `/api/channels/:channelId/latest` | Get latest reading | Query: `?readApiKey=xxx` | `{reading}` |

---

## 🧪 AQI Calculation Formula

The system calculates Air Quality Index based on three sensor inputs:

```javascript
AQI = CO2_Score + Temperature_Score + Humidity_Score

CO2_Score:
  400-600 ppm   → 0-25 points   (Good air quality)
  600-1000 ppm  → 25-75 points  (Moderate quality)
  1000-1500 ppm → 75-150 points (Poor quality)
  1500+ ppm     → 150-300 points (Very poor)

Temperature_Score:
  Optimal: 23°C (0 points)
  Deviation: Each degree away adds 5-10 points

Humidity_Score:
  Optimal: 40-60% (0 points)
  Outside range: Each % adds 0.5 points
```

### AQI Categories (EPA Standard)
- **0-50**: Good (Green)
- **51-100**: Moderate (Yellow)
- **101-150**: Unhealthy for Sensitive Groups (Orange)
- **151-200**: Unhealthy (Red)
- **201-300**: Very Unhealthy (Purple)
- **300+**: Hazardous (Maroon)


## 📱 Mobile App User Flow (Fig 5)

```
App Launch
    ↓
Check Authentication
    ↓
├─ Not Logged In ──→ Login Screen ──→ [Enter email/password] ──→ Dashboard
│                         ↓
│                    Register Link ──→ Register Screen ──→ [Create account] ──→ Login Screen
│
└─ Logged In ──→ Dashboard
                    ↓
                 [Welcome, username!]
                    ↓
                 Channel Selection
                    ↓
    ┌───────────────┼───────────────┐
    │               │               │
Channel 1      Channel 2      [+ Add Channel]
    │               │               │
    └───────────────┼───────────────┘
                    ↓
           Real-time Air Quality Display
                    ↓
    ┌───────────────────────────────────┐
    │ AQI Gauge | CO2 | Temp | Humidity │
    │ Historical Trend Charts            │
    │ Auto-refresh every 15s             │
    │ Pull-to-refresh                    │
    └───────────────────────────────────┘
```

---

## 🔍 Mapping to Research Paper Figures

### Figure 1: System Hardware Blocks
**Paper**: Real ESP8266 + MQ135 + DHT11 → Heroku Cloud  
**Our Implementation**: Simulated ESP8266 (simulator/nodemcu.js) → Express Server

### Figure 3: Software Flow Chart
**Paper**: Power on → Sensor read → WiFi connect → Upload to cloud  
**Our Implementation**: Exactly matches - see `simulator/nodemcu.js` main loop

### Figure 4: Workflow Diagram
**Paper**: Sensors → Data Source → Server → Database → Frontend  
**Our Implementation**: NodeMCU sim → Express API → JSON DB → React Native app

### Figure 5: Frontend Workflow
**Paper**: Home → Register/Login → Dashboard → Channel views  
**Our Implementation**: Exactly matches - see `app/login.tsx`, `app/(tabs)/index.tsx`

### Figure 8: Create Channel Flow
**Paper**: Enter details → Validate → Generate API keys → Store → Display  
**Our Implementation**: Exactly matches - see `backend/database.js` channels.create()

---

## 📦 File Structure Summary

```
project/
├── backend/
│   ├── server.js           # Main API server (Fig 4)
│   ├── database.js         # Data persistence layer
│   └── data.json           # Database file (auto-generated)
├── simulator/
│   ├── nodemcu.js          # ESP8266 simulator (Fig 1 & Fig 3)
│   ├── setup.js            # One-time setup script
│   └── .env.simulator      # Generated credentials (auto-created)
├── app/
│   ├── login.tsx           # Login screen (Fig 5)
│   ├── register.tsx        # Registration screen (Fig 5)
│   ├── modal.tsx           # Create channel modal (Fig 8)
│   └── (tabs)/
│       ├── index.tsx       # Dashboard with channel selection (Fig 5)
│       └── explore.tsx     # Information screen
├── components/             # Reusable UI components
├── docs/
│   └── ARCHITECTURE.md     # This file
└── package.json            # NPM scripts
```

---

## 🎯 Key Differences from Paper

| Aspect | Research Paper | Our Implementation | Reason |
|--------|----------------|-------------------|---------|
| Cloud Platform | Heroku | Local Express Server | No Heroku deployment needed |
| IoT Hardware | Real ESP8266/MQ135/DHT11 | Simulated sensors | Hardware not available |
| Mobile Platform | MIT App Inventor | React Native | Better cross-platform support |
| Database | ThingSpeak | JSON file | Simpler for demo/testing |
| Deployment | Cloud-hosted | Local network | Easier testing on phone |

**Important**: The architecture and data flow are **identical** to the paper. Only the specific technologies differ for practical implementation without physical hardware.

---

## ✅ Verification Checklist

- [x] User authentication system (Fig 5: Register/Login)
- [x] Channel management with API keys (Fig 8)
- [x] NodeMCU simulator following software flow (Fig 3)
- [x] Sensor data transmission with authentication
- [x] Mobile app with channel selection
- [x] Real-time data display with auto-refresh
- [x] AQI calculation from sensor readings
- [x] Historical trend visualization
- [x] Multi-user, multi-channel support

---

## 🎓 Educational Value

This implementation demonstrates:
1. **IoT Architecture**: 3-tier system (sensor → server → app)
2. **REST API Design**: Authentication, CRUD operations, data endpoints
3. **Real-time Systems**: Periodic sensor readings, auto-refresh
4. **Security**: API key authentication, password hashing
5. **Mobile Development**: Cross-platform React Native app
6. **Database Design**: Users, channels, readings relationships
7. **System Integration**: Multiple components working together

---

**Status**: ✅ Complete implementation following research paper architecture
**Date**: November 22, 2025
**Version**: 1.0
