# 🎯 Quick Reference Cheat Sheet

## 🚀 Starting Fresh (EASIEST WAY)

```bash
cd /home/mylappy/Desktop/cnproject/project
./scripts/fresh-start.sh
```

This automated script will:
- ✅ Stop all old processes
- ✅ Clear the database
- ✅ Detect your IP address
- ✅ Update .env file
- ✅ Guide you through starting everything

---

## 📋 Manual Start (3 Terminals Needed)

### Terminal 1: Backend Server
```bash
cd /home/mylappy/Desktop/cnproject/project
node backend/server.js
```
**Expected:** `Server running on http://0.0.0.0:3000`

### Terminal 2: Mobile App
```bash
cd /home/mylappy/Desktop/cnproject/project
npm start
```
**Expected:** QR code appears → Scan with Expo Go on phone

### Terminal 3: NodeMCU Simulator
```bash
cd /home/mylappy/Desktop/cnproject/project
CHANNEL_ID=your_channel_id \
WRITE_API_KEY=your_write_key \
SERVER_URL=http://YOUR_IP:3000 \
node simulator/nodemcu.js
```
**Expected:** `✓ Data sent successfully` every 10 seconds

---

## 🛠️ Utility Commands

### Check System Status
```bash
./scripts/status.sh
```
Shows what's running and what's not.

### Stop Everything & Clean
```bash
./scripts/clean.sh
```
Kills all processes and deletes database.

### Get Your IP Address
```bash
hostname -I
```

### Check if Backend is Running
```bash
curl http://localhost:3000/api/health
```

### Kill Specific Process
```bash
# Kill backend
pkill -f "node.*server.js"

# Kill simulator
pkill -f "node.*nodemcu.js"

# Kill Expo
pkill -f "expo start"
```

---

## 📱 Phone Setup Workflow

1. **Install Expo Go** app from Play Store/App Store
2. **Connect to same WiFi** as your computer
3. **Start backend** (`node backend/server.js`)
4. **Start mobile app** (`npm start`)
5. **Scan QR code** with Expo Go
6. **Register** a new account
7. **Create channel** and SAVE the API keys shown:
   - Channel ID: `channel_xxxxx`
   - Write API Key: `xxxxxxxx`
   - Read API Key: `yyyyyyyy`
8. **Start simulator** with those credentials
9. **Watch real-time data** update on your phone!

---

## 🔧 Common Issues & Fixes

### Issue: "Cannot connect to server"
**Fix:**
```bash
# Get your IP
hostname -I

# Update .env
echo "EXPO_PUBLIC_API_BASE=http://YOUR_IP:3000" > .env

# Restart mobile app
```

### Issue: "Channel not showing"
**Fix:** Click the **🔄 Refresh** button on dashboard

### Issue: "No data showing"
**Fix:** 
1. Check simulator is running (Terminal 3)
2. Look for "✓ Data sent successfully" in simulator logs
3. Wait 15 seconds for next auto-refresh

### Issue: "Port 3000 already in use"
**Fix:**
```bash
# Kill whatever is using port 3000
lsof -ti:3000 | xargs kill -9

# Or use the clean script
./scripts/clean.sh
```

---

## 📊 What You Should See

### Backend Terminal:
```
Database initialized
Server running on http://0.0.0.0:3000
POST /api/auth/register 201
POST /api/channels/create 201
POST /api/sensor-data 200
```

### Simulator Terminal:
```
[NodeMCU] Initializing sensors...
[NodeMCU] Connected to WiFi
[NodeMCU] ✓ Data sent successfully
[NodeMCU] Reading: CO2=523ppm, Temp=23.1°C, Humidity=52.3%
```

### Phone App:
```
┌─────────────────────────┐
│ Welcome, Username!      │
│ My Channels    [Refresh]│
│ ┌─────────────┐         │
│ │  My Room    │         │
│ │  Bedroom    │ [Delete]│
│ └─────────────┘         │
├─────────────────────────┤
│    Air Quality Index    │
│         ┌───┐           │
│         │ 42│           │
│         └───┘           │
│         Good            │
├─────────────────────────┤
│  23.5°C  523ppm  52.3%  │
└─────────────────────────┘
```

---

## 🎯 Success Checklist

- [ ] Backend running on port 3000
- [ ] Mobile app showing on phone (scanned QR)
- [ ] Logged in with your account
- [ ] Channel created with API keys saved
- [ ] Simulator running (see "✓ Data sent")
- [ ] Dashboard shows live AQI value
- [ ] Data updates every 15 seconds

---

## 📞 Getting Credentials

Your API keys are shown **once** when you create a channel:

```
Channel Created!

Channel ID: channel_1234567890_abcdef
Write API Key: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Read API Key: q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

Save these keys! You'll need them for the simulator.
```

**IMPORTANT:** Copy these immediately! They're not shown again.

---

## 📂 Project Structure

```
project/
├── backend/
│   ├── server.js       ← API server
│   ├── database.js     ← Data management
│   └── data.json       ← Database (auto-created)
├── simulator/
│   ├── nodemcu.js      ← Sensor simulator
│   └── setup.js        ← Demo setup
├── app/
│   ├── login.tsx       ← Login screen
│   ├── register.tsx    ← Registration
│   └── (tabs)/
│       └── index.tsx   ← Main dashboard
├── scripts/
│   ├── fresh-start.sh  ← Automated setup
│   ├── clean.sh        ← Stop & clean
│   └── status.sh       ← Check status
├── FRESH_START.md      ← Detailed guide
└── CHEAT_SHEET.md      ← This file!
```

---

## 🎉 Quick Win Path

**Fastest way to see it working:**

```bash
# 1. Clean everything
./scripts/clean.sh

# 2. Start fresh (follow prompts)
./scripts/fresh-start.sh

# 3. In another terminal
npm start

# 4. On phone: Register → Create Channel → Copy Keys

# 5. In another terminal (use your keys)
CHANNEL_ID=your_channel_id \
WRITE_API_KEY=your_key \
SERVER_URL=http://192.168.1.12:3000 \
node simulator/nodemcu.js

# 🎊 Done! Watch the magic happen!
```

---

Need help? Check:
- **FRESH_START.md** - Detailed walkthrough
- **docs/ARCHITECTURE.md** - System design
- Terminal logs for error messages
