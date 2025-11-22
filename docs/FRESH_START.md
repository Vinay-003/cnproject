# 🚀 IoT Air Quality Monitoring System - Fresh Start Guide

## Prerequisites
- Node.js installed (v16 or higher)
- Expo Go app installed on your phone (Android/iOS)
- Phone and computer on the same WiFi network

---

## 📋 Step-by-Step Fresh Start

### **Step 1: Clean Database**
Remove the old database to start fresh:
```bash
cd /home/mylappy/Desktop/cnproject/project
rm -f backend/data.json
echo "✅ Database cleared"
```

### **Step 2: Install Dependencies** (if needed)
```bash
cd /home/mylappy/Desktop/cnproject/project
npm install
```

### **Step 3: Start Backend Server**
Open a **NEW terminal** and run:
```bash
cd /home/mylappy/Desktop/cnproject/project
node backend/server.js
```

**Expected output:**
```
Database initialized
Server running on http://0.0.0.0:3000
```

Keep this terminal running!

---

### **Step 4: Start Mobile App**
Open **ANOTHER NEW terminal** and run:
```bash
cd /home/mylappy/Desktop/cnproject/project
npm start
```

**Expected output:**
- QR code will appear
- Scan with Expo Go app on your phone

Keep this terminal running!

---

### **Step 5: Create Your Account**
1. On your phone, the app will open
2. Click **"Register"**
3. Create account with:
   - Username: (your choice)
   - Email: (your choice)
   - Password: (your choice)
4. After registration, you'll be logged in automatically

---

### **Step 6: Create Your First Channel**
1. On the dashboard, click **"+ Create Channel"**
2. Enter:
   - **Channel Name**: "My Room" (or any name)
   - **Description**: "Bedroom air quality"
3. Click **Create**
4. **IMPORTANT**: Copy the API keys shown in the alert:
   - Channel ID: `channel_xxxxx`
   - Write API Key: `xxxxxxxxxxxxxxxx`
   - Read API Key: `yyyyyyyyyyyyyyyy`
5. Save these somewhere (Notes app) - you'll need them for the simulator!

---

### **Step 7: Start NodeMCU Simulator**
Open **ANOTHER NEW terminal** and run with YOUR credentials:

```bash
cd /home/mylappy/Desktop/cnproject/project
CHANNEL_ID=channel_1763814674678_993fecf5 WRITE_API_KEY=d52ec705b9fad8455e74a2a0a132aeff SERVER_URL=http://192.168.1.12:3000 node simulator/nodemcu.js
```

**Replace**:
- `channel_xxxxx` with YOUR Channel ID from Step 6
- `xxxxxxxx` with YOUR Write API Key from Step 6
- `192.168.1.12` with your computer's IP (check with `hostname -I`)

**Expected output:**
```
[NodeMCU] Initializing sensors...
[NodeMCU] Connected to WiFi
[NodeMCU] Server: http://192.168.1.12:3000
[NodeMCU] ✓ Data sent successfully
[NodeMCU] Reading: CO2=523ppm, Temp=23.1°C, Humidity=52.3%
```

Keep this terminal running!

---

### **Step 8: Watch Real-Time Data**
1. On your phone, make sure your channel is selected
2. You should see:
   - ✅ AQI gauge updating
   - ✅ Temperature, CO2, Humidity cards
   - ✅ Charts updating every 15 seconds
3. Data refreshes automatically!

---

## 🔧 Quick Troubleshooting

### Problem: "Cannot connect to server"
**Solution:** Check your IP address and update `.env` file:
```bash
# Get your IP
hostname -I

# Update .env file
echo "EXPO_PUBLIC_API_BASE=http://YOUR_IP:3000" > .env
```
Then restart the mobile app (Step 4).

---

### Problem: "Channel not appearing"
**Solution:** Click the **"🔄 Refresh"** button on the dashboard

---

### Problem: "No data showing"
**Solution:** 
1. Make sure NodeMCU simulator is running (Step 7)
2. Check the simulator terminal for "✓ Data sent successfully"
3. Wait 15 seconds for next data fetch

---

### Problem: Backend shows error
**Solution:** Kill all node processes and restart:
```bash
pkill -f node
# Then start backend again (Step 3)
```

---

## 📱 What You Should See

### Dashboard (After Login):
```
┌────────────────────────────┐
│  Welcome, YourName!  [Logout]│
├────────────────────────────┤
│  My Channels      [🔄 Refresh]│
│  ┌──────────┐              │
│  │ My Room  │              │
│  │ Bedroom  │   [Delete]   │
│  │ channel_xxx              │
│  └──────────┘              │
├────────────────────────────┤
│      Air Quality           │
│         ┌───┐              │
│         │ 42 │             │
│         └───┘              │
│         Good               │
├────────────────────────────┤
│  🌡️ Temp    💨 CO2   💧 Humidity│
│   23.5°C    523ppm    52%  │
└────────────────────────────┘
```

---

## 🎯 Summary - 3 Terminals Required

1. **Terminal 1**: Backend Server (`node backend/server.js`)
2. **Terminal 2**: Mobile App (`npm start`)
3. **Terminal 3**: NodeMCU Simulator (`CHANNEL_ID=... node simulator/nodemcu.js`)

All three must be running simultaneously!

---

## 📝 Quick Command Cheat Sheet

```bash
# Get your computer's IP
hostname -I

# Check if backend is running
curl http://localhost:3000/api/health

# View backend logs
cd /home/mylappy/Desktop/cnproject/project
node backend/server.js

# Restart everything
pkill -f node
# Then run Steps 3, 4, 7 again
```

---

## 🎉 Success Checklist

- [ ] Backend server running (port 3000)
- [ ] Mobile app showing on phone
- [ ] Account created and logged in
- [ ] Channel created with API keys saved
- [ ] NodeMCU simulator running and sending data
- [ ] Dashboard showing real-time data
- [ ] AQI gauge updating every 15 seconds

---

Need help? Check the terminals for error messages!
