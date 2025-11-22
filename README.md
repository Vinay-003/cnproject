# 🌬️ IoT-Based Air Quality Monitoring System

A React Native application for real-time monitoring and visualization of air quality and environmental data from IoT sensors.

## 🚀 **FRESH START** (Recommended)

**Want to start completely fresh? Run this:**
```bash
cd /home/mylappy/Desktop/cnproject/project
./scripts/fresh-start.sh
```

Or see **[FRESH_START.md](./FRESH_START.md)** for detailed manual steps.

**Useful Commands:**
- `./scripts/status.sh` - Check what's running
- `./scripts/clean.sh` - Stop all processes & clean database
- `./scripts/fresh-start.sh` - Complete fresh start with guide

---

## 📱 Overview

This air quality monitor is a cross-platform mobile application built with React Native and Expo that provides real-time monitoring of air quality metrics. The app displays current readings and historical trends for:

- **Air Quality Index (AQI)** - Calculated from sensor readings
- **CO₂ levels** (ppm) - Carbon dioxide concentration
- **Temperature** (°C) - Ambient temperature
- **Humidity** (%) - Relative humidity

## ✨ What Makes This Special

- **Scientific AQI Calculation**: Not just random numbers! AQI is calculated based on actual sensor readings using a weighted formula
- **Realistic Sensor Simulation**: Gradual, natural changes that mimic real IoT sensor behavior
- **Real-time Updates**: Auto-refreshes every 15 seconds
- **Beautiful Visualizations**: Interactive charts, gauges, and color-coded status indicators

## Features

- Real-time data visualization with automatic polling
- AQI status indicators with color coding
- Interactive gauge visualization
- Historical trend charts for all metrics
- Responsive design with light/dark mode support
- Pull-to-refresh functionality

## Technical Implementation

The application is built using:

- React Native / Expo
- TypeScript
- File-based routing
- SVG-based data visualizations
- Parallel scroll views with parallax effects

## Project Structure

```
WeatherMonitor/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx      # Home screen with main dashboard
│   │   ├── explore.tsx    # Exploration/info screen
│   │   └── _layout.tsx    # Tab navigation configuration
│   ├── _layout.tsx        # Root layout with theme provider
│   └── modal.tsx          # Modal screen component
├── components/
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── parallax-scroll-view.tsx
│   └── ...
└── ...
```

## Data Flow

1. The app fetches air quality data from a configurable API endpoint
2. Data is polled at regular intervals (default: 15 seconds)
3. The UI updates in real-time with new readings
4. Historical data is stored and displayed as trend lines

## 🚀 Quick Start - Test on Your Phone

### Prerequisites
1. **On your phone**: Install **Expo Go** app from Play Store/App Store
2. **Network**: Ensure phone and computer are on the **same WiFi network**

### One-Command Start
```bash
npm run phone
```

This will:
- ✅ Start the backend API server with realistic sensor simulation
- ✅ Launch Expo with tunnel mode
- ✅ Display a QR code to scan with Expo Go

### Manual Start (Alternative)
```bash
# Terminal 1 - Start backend
npm run start:api

# Terminal 2 - Start Expo
npx expo start --tunnel
```

Then scan the QR code with Expo Go on your phone!

## 📖 Detailed Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development: `npm run phone`
4. Scan QR code with Expo Go app on your phone

See [PHONE_TESTING.md](PHONE_TESTING.md) for detailed instructions.

## 🔌 Starting the NodeMCU Simulator

### Quick Method (Easiest!)
1. Open the app on your phone
2. Navigate to **Home** tab
3. Tap the **⋮** (three dots) menu on any channel card
4. Choose **"🚀 Copy Simulator Command"**
5. Open a terminal on your computer
6. Navigate to project: `cd /path/to/cnproject/project`
7. Paste and run the command!

### Manual Method
In a new terminal, run:
```bash
CHANNEL_ID=your_channel_id \
WRITE_API_KEY=your_write_api_key \
SERVER_URL=http://192.168.1.12:3000 \
node simulator/nodemcu.js
```

**Note**: Replace `your_channel_id` and `your_write_api_key` with values from your channel (available in the app's channel info).

### What the Simulator Does
- 📊 Generates realistic sensor data every 15 seconds
- 🌡️ Temperature: 15-35°C with gradual changes
- 💧 Humidity: 30-80% with gradual changes
- ☁️ CO₂: 350-2000 ppm with realistic patterns
- 🌤️ AQI: Calculated from sensor readings (0-500 scale)

The simulator runs continuously until you press Ctrl+C to stop it.

## Environment Configuration

The application uses environment variables for configuration:

- `EXPO_PUBLIC_API_BASE`: Base URL for the API (defaults to http://localhost:3000)

## Future Improvements

- Add location-based monitoring
- Implement push notifications for unhealthy air quality alerts
- Add customizable thresholds and alert settings
- Expand historical data analysis

## License

[MIT License]