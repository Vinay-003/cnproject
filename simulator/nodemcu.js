#!/usr/bin/env node
/**
 * NodeMCU ESP8266 Simulator
 * Simulates the behavior of ESP8266 with sensors as per research paper
 * - Fig 1: Hardware blocks (ESP8266 + MQ135 + DHT11/DHT22)
 * - Fig 3: Software flow (authenticate → read sensors → send to cloud)
 */

const fetch = require('node-fetch');

// ============================================
// CONFIGURATION (As per Fig 3: Channel ID + API Key)
// ============================================

const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'http://192.168.1.12:3000',
  CHANNEL_ID: process.env.CHANNEL_ID || null,
  WRITE_API_KEY: process.env.WRITE_API_KEY || null,
  SEND_INTERVAL: 10000, // 10 seconds (matches paper's real-time requirement)
  SENSOR_TYPE: 'MQ135_DHT11' // As per Fig 1
};

// ============================================
// SENSOR SIMULATION (As per Fig 1)
// ============================================

// Sensor state (mimics real sensor behavior - gradual changes with wider range)
let sensorState = {
  co2: 600 + Math.random() * 400,        // MQ-135: Start between 600-1000 ppm
  temperature: 20 + Math.random() * 8,   // DHT11: Start between 20-28°C
  humidity: 35 + Math.random() * 35      // DHT11: Start between 35-70%
};

// Track cycles for dynamic variation
let cycleCount = 0;

/**
 * Simulate reading from MQ-135 CO2 sensor
 * Real MQ-135 reads analog values and converts to ppm
 * Simulates different environmental conditions over time
 */
function readMQ135() {
  cycleCount++;
  
  // Create dynamic patterns (simulate room occupancy, ventilation, etc.)
  const timePattern = Math.sin(cycleCount * 0.1) * 200; // Slow wave pattern
  const randomDrift = (Math.random() - 0.5) * 100; // ±50 ppm random change
  
  // Apply changes
  sensorState.co2 += randomDrift + timePattern * 0.05;
  
  // Clamp to realistic indoor CO2 range (400-1800 ppm for varied AQI)
  sensorState.co2 = Math.max(400, Math.min(1800, sensorState.co2));
  
  return Math.round(sensorState.co2);
}

/**
 * Simulate reading from DHT11/DHT22 temperature sensor
 * Real DHT11 provides digital temperature output
 * Simulates temperature variations throughout the day
 */
function readDHT11Temperature() {
  // Create daily temperature variation pattern
  const timePattern = Math.sin(cycleCount * 0.08) * 3; // ±3°C wave
  const randomDrift = (Math.random() - 0.5) * 2; // ±1°C random change
  
  // Apply changes
  sensorState.temperature += randomDrift + timePattern * 0.05;
  
  // Clamp to realistic indoor temperature range (16-32°C for varied conditions)
  sensorState.temperature = Math.max(16, Math.min(32, sensorState.temperature));
  
  return Math.round(sensorState.temperature * 10) / 10; // DHT11 accuracy: 0.1°C
}

/**
 * Simulate reading from DHT11/DHT22 humidity sensor
 * Real DHT11 provides digital humidity output
 * Simulates humidity variations (weather, ventilation, etc.)
 */
function readDHT11Humidity() {
  // Create humidity variation pattern
  const timePattern = Math.sin(cycleCount * 0.12) * 10; // ±10% wave
  const randomDrift = (Math.random() - 0.5) * 6; // ±3% random change
  
  // Apply changes
  sensorState.humidity += randomDrift + timePattern * 0.05;
  
  // Clamp to realistic indoor humidity range (25-80% for varied conditions)
  sensorState.humidity = Math.max(25, Math.min(80, sensorState.humidity));
  
  return Math.round(sensorState.humidity * 10) / 10; // DHT11 accuracy: 0.1%
}

/**
 * Read all sensors (as per Fig 3: "Sensor read data and measured locally")
 */
function readAllSensors() {
  return {
    co2: readMQ135(),
    temperature: readDHT11Temperature(),
    humidity: readDHT11Humidity()
  };
}

// ============================================
// NETWORK COMMUNICATION (As per Fig 3)
// ============================================

/**
 * Send sensor data to cloud server (as per Fig 3: "Transfer data to the cloud via internet")
 */
async function sendDataToCloud(data) {
  try {
    const response = await fetch(`${CONFIG.SERVER_URL}/api/sensor-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: CONFIG.CHANNEL_ID,
        writeApiKey: CONFIG.WRITE_API_KEY,
        co2: data.co2,
        temperature: data.temperature,
        humidity: data.humidity
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Check internet connection (as per Fig 3: "Check internet connection")
 */
async function checkInternetConnection() {
  try {
    const response = await fetch(`${CONFIG.SERVER_URL}/api/health`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// ============================================
// MAIN NODEMCU LOGIC (As per Fig 3 Software Flow)
// ============================================

async function nodeMcuLoop() {
  console.log('─────────────────────────────────────────');
  console.log(`[${new Date().toLocaleTimeString()}] NodeMCU Cycle Started`);
  
  try {
    // Step 1: Read sensors (Fig 3: "Sensor read data and measured locally")
    console.log('📡 Reading sensors...');
    const sensorData = readAllSensors();
    console.log(`  MQ-135 (CO2): ${sensorData.co2} ppm`);
    console.log(`  DHT11 (Temp): ${sensorData.temperature}°C`);
    console.log(`  DHT11 (Hum):  ${sensorData.humidity}%`);
    
    // Step 2: Check internet connection (Fig 3: "Check internet connection")
    console.log('🌐 Checking internet connection...');
    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      console.log('❌ No internet connection. Will retry next cycle.');
      return;
    }
    console.log('✅ Connected to server');
    
    // Step 3: Validate credentials (Fig 3: "Is the credentials correct?")
    if (!CONFIG.CHANNEL_ID || !CONFIG.WRITE_API_KEY) {
      console.log('❌ Missing Channel ID or API Key. Please configure first.');
      process.exit(1);
    }
    
    // Step 4: Send data to cloud (Fig 3: "Transfer data to the cloud via internet")
    console.log('☁️  Sending data to cloud...');
    const result = await sendDataToCloud(sensorData);
    console.log('✅ Data sent successfully!');
    console.log(`  Calculated AQI: ${result.reading.aqi}`);
    console.log(`  Timestamp: ${result.reading.timestamp}`);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('─────────────────────────────────────────');
}

// ============================================
// STARTUP (As per Fig 3: Power on → Initialize)
// ============================================

async function initialize() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         NodeMCU ESP8266 Simulator - Starting...               ║');
  console.log('║         IoT Air Quality Monitoring System                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('🔧 Hardware Configuration (Simulated):');
  console.log('   - NodeMCU ESP8266 (WiFi Module)');
  console.log('   - MQ-135 Gas Sensor (CO2 detection)');
  console.log('   - DHT11 Sensor (Temperature & Humidity)');
  console.log('   - Power Supply: USB 5V');
  console.log('');
  console.log('🌐 Network Configuration:');
  console.log(`   - Server: ${CONFIG.SERVER_URL}`);
  console.log(`   - Channel ID: ${CONFIG.CHANNEL_ID || 'NOT SET'}`);
  console.log(`   - Write API Key: ${CONFIG.WRITE_API_KEY ? '••••••••' + CONFIG.WRITE_API_KEY.slice(-4) : 'NOT SET'}`);
  console.log(`   - Send Interval: ${CONFIG.SEND_INTERVAL / 1000}s`);
  console.log('');

  // Check if credentials are set
  if (!CONFIG.CHANNEL_ID || !CONFIG.WRITE_API_KEY) {
    console.log('⚠️  WARNING: Channel ID or API Key not configured!');
    console.log('');
    console.log('To configure, set environment variables:');
    console.log('  export CHANNEL_ID=your_channel_id');
    console.log('  export WRITE_API_KEY=your_write_api_key');
    console.log('');
    console.log('Or provide them when running:');
    console.log('  CHANNEL_ID=xxx WRITE_API_KEY=yyy node simulator/nodemcu.js');
    console.log('');
    console.log('❌ Cannot proceed without credentials. Exiting...');
    process.exit(1);
  }

  // Test connection (Fig 3: "Reset Wi-Fi module")
  console.log('🔌 Testing connection to server...');
  const isConnected = await checkInternetConnection();
  if (!isConnected) {
    console.log('❌ Cannot connect to server. Please check:');
    console.log('   1. Server is running');
    console.log('   2. SERVER_URL is correct');
    console.log('   3. Network is accessible');
    process.exit(1);
  }
  console.log('✅ Connected to server successfully!');
  console.log('');
  console.log('🚀 NodeMCU is ready. Starting sensor data transmission...');
  console.log('');

  // Start periodic sensor reading and transmission
  setInterval(nodeMcuLoop, CONFIG.SEND_INTERVAL);
  
  // First reading immediately
  nodeMcuLoop();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 NodeMCU simulator shutting down...');
  process.exit(0);
});

// Start the simulator
initialize().catch(error => {
  console.error('Fatal error during initialization:', error);
  process.exit(1);
});
