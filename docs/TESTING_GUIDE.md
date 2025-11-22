# Testing Guide - Historical Data Analysis & Detailed AQI

## Prerequisites
1. Backend server running on port 3000
2. Expo app running on mobile device/emulator
3. NodeMCU simulator ready to send data

---

## Step-by-Step Testing

### 1. Start Backend Server

```bash
cd /home/mylappy/Desktop/cnproject/project
node backend/server.js
```

Expected output:
```
Air Quality Monitoring Server running on port 3000
Database initialized at: backend/db.json
```

---

### 2. Start Mobile App

```bash
npm start
```

Then:
- Press `a` for Android emulator
- Or scan QR code with Expo Go app

---

### 3. Login/Create Account

1. Open the app
2. Login or create a new account
3. You should see the home dashboard

---

### 4. Create a Channel (if you don't have one)

1. Tap the **"+ Add Channel"** button
2. Fill in:
   - Channel Name: "My Home Sensor"
   - Description: "Living room air quality"
   - Location: Optional (latitude, longitude, general location)
3. Tap **"Create Channel"**
4. Channel should appear in the horizontal scroll list

---

### 5. Start Simulator with All 5 Sensors

Find your channel ID and Write API Key:

1. Tap the **⋮** button on your channel card
2. Copy the Channel ID and Write API Key

Open a new terminal and run:

```bash
cd /home/mylappy/Desktop/cnproject/project

# Method 1: Using environment variables
CHANNEL_ID=your_channel_id_here \
WRITE_API_KEY=your_write_api_key_here \
SERVER_URL=http://localhost:3000 \
node simulator/nodemcu.js

# Method 2: Using the app's integrated simulator (recommended)
# Just tap "▶️ Start" button on the channel card
```

Expected simulator output:
```
═══════════════════════════════════════════════════════════
  NodeMCU ESP8266 Air Quality Monitoring System
  Hardware Configuration (Research Paper Table 1):
    • MH-Z14 CO2 Sensor (350-5000 ppm) - UART
    • MiCS 4514 CO Sensor (0.88-29.7 ppm) - via ADS1115 I2C
    • MiCS 4514 NO2 Sensor (0.022-0.213 ppm) - via ADS1115 I2C
    • LM35 Temperature Sensor (-2 to 40°C) - via ADS1115 I2C
    • HIH-4030 Humidity Sensor (50-80%) - via ADS1115 I2C
    • ADS1115 16-bit ADC Module (I2C Interface)
═══════════════════════════════════════════════════════════
🔌 Connecting to WiFi...
✅ WiFi connected!
🌐 IP address: 192.168.1.100
📡 Server URL: http://localhost:3000

[10:30:15] Reading sensors...
  CO2: 850 ppm | CO: 3.50 ppm | NO2: 0.065 ppm | Temp: 23.5°C | Humidity: 55.2%
[10:30:15] ✅ Data sent successfully! AQI: 95
```

---

### 6. Verify Data Collection

On your mobile app, you should now see:

#### Home Tab:

1. **Live Air Quality Section** (6 metric cards):
   - ✅ AQI: 95 (with color-coded status: Good/Moderate/etc.)
   - ✅ CO₂: 850 ppm
   - ✅ CO: 3.50 ppm
   - ✅ NO₂: 0.065 ppm
   - ✅ Temp: 23.5°C
   - ✅ Humidity: 55.2%

2. **Pollutant Sub-Indices** (new section):
   - CO AQI: XX (with category label)
   - CO₂ AQI: XX (with category label)
   - NO₂ AQI: XX (with category label)
   - 🔴 icon next to dominant pollutant

3. **AQI Gauge**:
   - Semi-circular gauge showing overall AQI
   - Color changes based on AQI level

4. **Trends** (mini line charts):
   - AQI trend
   - CO₂ trend
   - Temperature trend
   - Humidity trend

5. **Historical Data Analysis** (new section):
   - Time range buttons: Hour, Day, Week, Month
   - Metric selector dropdown
   - Statistics: Min, Avg, Max, Current
   - Interactive line chart with scrolling

---

### 7. Test Historical Data Analysis

1. **Let simulator run for a few minutes** to collect data
2. Scroll down to **"Historical Data Analysis"** section
3. Test time range filters:
   - Tap **"Last Hour"** → should show last 60 minutes
   - Tap **"Last Day"** → should show last 24 hours
   - Tap **"Last Week"** → should show last 7 days
   - Tap **"Last Month"** → should show last 30 days

4. Test metric switching:
   - Select **"AQI"** → chart shows AQI values
   - Select **"CO₂"** → chart shows CO₂ in ppm
   - Select **"CO"** → chart shows CO in ppm
   - Select **"NO₂"** → chart shows NO₂ in ppm
   - Select **"Temperature"** → chart shows temperature in °C
   - Select **"Humidity"** → chart shows humidity in %

5. Verify statistics update:
   - Min, Avg, Max, Current values should change with metric
   - Values should be accurate based on visible chart data

6. Test chart interactions:
   - Chart should be scrollable horizontally if data exceeds viewport
   - Time labels on X-axis should show timestamps
   - Grid lines should be visible
   - Data line should connect all points
   - Latest data point should be highlighted

---

### 8. Test Public Stations (Explore Tab)

1. Go to **Explore** tab
2. Make one of your channels public:
   - Go back to Home tab
   - Tap ⋮ on a channel → "Make Public" (if feature exists)
   - Or check channel in modal and toggle "Make Public"

3. Return to Explore tab
4. Pull down to refresh
5. Public stations should now show:
   - ✅ Channel name and location
   - ✅ AQI status with color badge
   - ✅ CO₂ reading
   - ✅ CO reading (new!)
   - ✅ NO₂ reading (new!)
   - ✅ Temperature
   - ✅ Humidity
   - ✅ Last update timestamp

---

### 9. Test AQI Calculation Accuracy

#### Test Case 1: Good Air Quality
```bash
# Manually send data to API
curl -X POST http://localhost:3000/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "your_channel_id",
    "writeApiKey": "your_write_api_key",
    "co2": 400,
    "co": 0.5,
    "no2": 0.01,
    "temperature": 22,
    "humidity": 50
  }'
```

Expected:
- Overall AQI: ~25-30 (Good)
- CO AQI: Good
- CO₂ AQI: Satisfactory
- NO₂ AQI: Good
- Badge color: Green

#### Test Case 2: Moderate Air Quality
```bash
curl -X POST http://localhost:3000/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "your_channel_id",
    "writeApiKey": "your_write_api_key",
    "co2": 550,
    "co": 5.0,
    "no2": 0.07,
    "temperature": 25,
    "humidity": 60
  }'
```

Expected:
- Overall AQI: ~110-120 (Moderate)
- CO AQI: Moderate
- CO₂ AQI: Moderate
- NO₂ AQI: Moderate
- Badge color: Yellow

#### Test Case 3: Poor Air Quality
```bash
curl -X POST http://localhost:3000/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "your_channel_id",
    "writeApiKey": "your_write_api_key",
    "co2": 800,
    "co": 12.0,
    "no2": 0.12,
    "temperature": 28,
    "humidity": 70
  }'
```

Expected:
- Overall AQI: ~170-180 (Poor)
- CO AQI: Poor
- CO₂ AQI: Poor
- NO₂ AQI: Poor
- Badge color: Orange
- Dominant pollutant indicator (🔴)

---

### 10. Verify Backend API Endpoints

#### Get Latest Reading
```bash
curl http://localhost:3000/api/channels/your_channel_id/latest
```

Expected response:
```json
{
  "reading": {
    "id": "reading_xxx",
    "channelId": "your_channel_id",
    "timestamp": "2025-11-22T10:30:00.000Z",
    "aqi": 95,
    "co2": 850,
    "co": 3.5,
    "no2": 0.065,
    "temperature": 23.5,
    "humidity": 55.2
  }
}
```

#### Get Historical Data (Last Hour)
```bash
# Calculate timestamps
START_TIME=$(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%SZ')
END_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

curl "http://localhost:3000/api/channels/your_channel_id/readings?startTime=$START_TIME&endTime=$END_TIME&limit=100"
```

Expected response:
```json
{
  "readings": [
    {
      "id": "reading_001",
      "channelId": "your_channel_id",
      "timestamp": "2025-11-22T09:30:00.000Z",
      "aqi": 92,
      "co2": 840,
      "co": 3.4,
      "no2": 0.063,
      "temperature": 23.2,
      "humidity": 54.8
    },
    ...
  ]
}
```

---

## Expected Features Checklist

### ✅ Home Tab Features
- [x] 6 metric cards (AQI, CO₂, CO, NO₂, Temp, Humidity)
- [x] Pollutant sub-indices display
- [x] Dominant pollutant indicator
- [x] Color-coded AQI categories (6 levels)
- [x] AQI gauge visualization
- [x] Mini trend charts (4 metrics)
- [x] Historical data analysis component
- [x] Time range filters (Hour/Day/Week/Month)
- [x] Metric selector (6 options)
- [x] Statistics display (Min/Avg/Max/Current)
- [x] Interactive scrollable chart
- [x] Auto-refresh every 15 seconds

### ✅ Explore Tab Features
- [x] Public stations list
- [x] 6 sensor readings per station
- [x] CO and NO₂ display
- [x] AQI badge with color
- [x] Location information
- [x] Pull-to-refresh

### ✅ Backend Features
- [x] Time-range query support
- [x] CO and NO₂ storage
- [x] Research paper compliant AQI calculation
- [x] Sub-index calculation for each pollutant
- [x] Overall AQI = max(CO_AQI, CO2_AQI, NO2_AQI)
- [x] Backward compatibility (defaults for missing data)

### ✅ Simulator Features
- [x] 5 sensors matching research paper Table 1
- [x] MH-Z14 CO₂ sensor (350-5000 ppm)
- [x] MiCS 4514 CO sensor (0.88-29.7 ppm)
- [x] MiCS 4514 NO₂ sensor (0.022-0.213 ppm)
- [x] LM35 temperature sensor (-2 to 40°C)
- [x] HIH-4030 humidity sensor (50-80%)
- [x] Realistic value ranges
- [x] 10-second send interval

---

## Troubleshooting

### Issue: No data showing on mobile app

**Solution:**
1. Check backend server is running: `curl http://localhost:3000/api/health`
2. Check simulator is running and sending data
3. Verify channel ID and API keys match
4. Check network connectivity (use actual IP instead of localhost on mobile)

### Issue: Historical data not loading

**Solution:**
1. Ensure there's enough data (let simulator run for a few minutes)
2. Check browser console for API errors
3. Verify time range query parameters are correct
4. Try refreshing the component

### Issue: CO and NO₂ showing as 0.0

**Solution:**
1. Check simulator is using updated `nodemcu.js` with CO and NO₂ sensors
2. Verify backend is storing CO and NO₂ (check db.json)
3. Restart simulator with new sensor configuration

### Issue: AQI not matching expected values

**Solution:**
1. Verify pollutant values are within research paper ranges
2. Check `aqiCalculator.ts` is being used
3. Review sub-index calculations in backend
4. Test with known good values (see Test Cases above)

### Issue: Chart not scrolling

**Solution:**
1. Ensure there are enough data points (>10)
2. Check SVG width is calculated correctly
3. Verify ScrollView is wrapping the chart

---

## Performance Notes

- Historical data fetches up to 100 readings per query
- Auto-refresh occurs every 15 seconds
- Simulator sends data every 10 seconds
- Charts render efficiently with memoization
- Public stations load in parallel

---

## Next Steps (Optional Enhancements)

1. Add custom date range picker for historical data
2. Implement data export to CSV
3. Add push notifications for high AQI alerts
4. Create comparative analysis between time periods
5. Add trend predictions using linear regression
6. Implement offline mode with local caching

---

## Success Criteria

✅ **All 5 sensors (CO₂, CO, NO₂, Temp, Humidity) are working**

✅ **Detailed AQI calculation matches research paper Table 2**

✅ **Historical data analysis shows hour/day/week/month views**

✅ **Statistics (min/max/avg) calculate correctly**

✅ **Charts render smoothly and are interactive**

✅ **Public stations display all sensor data**

✅ **Pollutant sub-indices show with dominant indicator**

✅ **Auto-refresh keeps data current**

✅ **No TypeScript/JavaScript errors**

---

## Documentation References

- Research Paper: `docs/IoT_purkayastha2021.pdf`
- Implementation Details: `docs/HISTORICAL_DATA_AQI_IMPLEMENTATION.md`
- AQI Calculator: `utils/aqiCalculator.ts`
- Historical Component: `components/historical-data-analysis.tsx`
- Backend Server: `backend/server.js`
- Database: `backend/database.js`
- Simulator: `simulator/nodemcu.js`

---

**Happy Testing! 🎉**
