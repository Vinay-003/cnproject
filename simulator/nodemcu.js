#!/usr/bin/env node
/**
 * NodeMCU ESP8266 Simulator
 * Simulates the behavior of ESP8266 with sensors as per research paper
 * - Fig 1: Hardware blocks (ESP8266 + MQ135 + DHT11/DHT22)
 * - Fig 3: Software flow (authenticate → read sensors → send to cloud)
 */

const fetch = require('node-fetch');
const mqtt = require('mqtt');

// ============================================
// CONFIGURATION (As per Fig 3: Channel ID + API Key)
// ============================================

const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'http://192.168.1.12:3000',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://192.168.1.12:1883',
  CHANNEL_ID: process.env.CHANNEL_ID || null,
  WRITE_API_KEY: process.env.WRITE_API_KEY || null,
  SEND_INTERVAL: 10000, // 10 seconds (matches paper's real-time requirement)
  SENSOR_TYPE: 'MQ135_DHT11', // As per Fig 1
  USE_MQTT: process.env.USE_MQTT === 'true' || false, // Toggle between HTTP and MQTT
  MQTT_QOS: parseInt(process.env.MQTT_QOS || '1'), // QoS level: 0, 1, or 2
};

// MQTT client (if enabled)
let mqttClient = null;
let mqttConnected = false;

// ============================================
// SENSOR SIMULATION (As per Fig 1)
// ============================================

// Sensor state (mimics real sensor behavior - gradual changes with wider range)
// As per research paper Table 1: Sensor characteristics
let sensorState = {
  co2: 600 + Math.random() * 400,        // MH-Z14: Start between 600-1000 ppm (range 350-5000)
  co: 2 + Math.random() * 5,             // MiCS 4514: Start between 2-7 ppm (range 0.88-29.7)
  no2: 0.05 + Math.random() * 0.08,      // MiCS 4514: Start between 0.05-0.13 ppm (range 0.022-0.213)
  temperature: 20 + Math.random() * 8,   // LM35: Start between 20-28°C (range -2 to 40°C)
  humidity: 35 + Math.random() * 35      // HIH-4030: Start between 35-70% (range 50-80%)
};

// Track cycles for dynamic variation
let cycleCount = 0;

/**
 * Simulate reading from MH-Z14 CO2 sensor (as per research paper Table 1)
 * Operating range: 350-5000 ppm, Voltage: 4.5-5.5V
 * Real sensor reads analog values via ADS1115 and converts to ppm
 */
function readMHZ14_CO2() {
  cycleCount++;
  
  // Create dynamic patterns (simulate room occupancy, ventilation, etc.)
  const timePattern = Math.sin(cycleCount * 0.1) * 200; // Slow wave pattern
  const randomDrift = (Math.random() - 0.5) * 100; // ±50 ppm random change
  
  // Apply changes
  sensorState.co2 += randomDrift + timePattern * 0.05;
  
  // Clamp to realistic indoor CO2 range (400-1800 ppm for varied AQI)
  sensorState.co2 = Math.max(350, Math.min(2000, sensorState.co2));
  
  return Math.round(sensorState.co2);
}

/**
 * Simulate reading from MiCS 4514 CO sensor (as per research paper Table 1)
 * Operating range: 0.88-29.7 ppm, Voltage: 4.9-5.1V
 * Reads both CO and NO2 from same sensor module via ADS1115
 */
function readMiCS4514_CO() {
  // Create variation pattern for CO (typically lower indoors)
  const timePattern = Math.sin(cycleCount * 0.15) * 3; // ±3 ppm wave
  const randomDrift = (Math.random() - 0.5) * 2; // ±1 ppm random change
  
  // Apply changes
  sensorState.co += randomDrift + timePattern * 0.05;
  
  // Clamp to operating range (0.88-29.7 ppm)
  sensorState.co = Math.max(0.88, Math.min(20, sensorState.co));
  
  return Math.round(sensorState.co * 100) / 100; // 2 decimal precision
}

/**
 * Simulate reading from MiCS 4514 NO2 sensor (as per research paper Table 1)
 * Operating range: 0.022-0.213 ppm, Voltage: 4.9-5.1V
 */
function readMiCS4514_NO2() {
  // Create variation pattern for NO2 (typically very low indoors)
  const timePattern = Math.sin(cycleCount * 0.18) * 0.03; // ±0.03 ppm wave
  const randomDrift = (Math.random() - 0.5) * 0.02; // ±0.01 ppm random change
  
  // Apply changes
  sensorState.no2 += randomDrift + timePattern * 0.05;
  
  // Clamp to operating range (0.022-0.213 ppm)
  sensorState.no2 = Math.max(0.022, Math.min(0.15, sensorState.no2));
  
  return Math.round(sensorState.no2 * 1000) / 1000; // 3 decimal precision
}

/**
 * Simulate reading from LM35 temperature sensor (as per research paper Table 1)
 * Operating range: -2 to 40°C, Voltage: 4.9-5.1V
 * Real sensor provides analog output via ADS1115
 */
function readLM35_Temperature() {
  // Create daily temperature variation pattern
  const timePattern = Math.sin(cycleCount * 0.08) * 3; // ±3°C wave
  const randomDrift = (Math.random() - 0.5) * 2; // ±1°C random change
  
  // Apply changes
  sensorState.temperature += randomDrift + timePattern * 0.05;
  
  // Clamp to realistic indoor temperature range (16-35°C for varied conditions)
  sensorState.temperature = Math.max(16, Math.min(35, sensorState.temperature));
  
  return Math.round(sensorState.temperature * 10) / 10; // 0.1°C precision
}

/**
 * Simulate reading from HIH-4030 humidity sensor (as per research paper Table 1)
 * Operating range: 50-80%, Voltage: 5.0V
 * Real sensor provides analog output via ADS1115
 */
function readHIH4030_Humidity() {
  // Create humidity variation pattern
  const timePattern = Math.sin(cycleCount * 0.12) * 10; // ±10% wave
  const randomDrift = (Math.random() - 0.5) * 6; // ±3% random change
  
  // Apply changes
  sensorState.humidity += randomDrift + timePattern * 0.05;
  
  // Clamp to operating range (50-80%)
  sensorState.humidity = Math.max(30, Math.min(80, sensorState.humidity));
  
  return Math.round(sensorState.humidity * 10) / 10; // 0.1% precision
}

/**
 * Read all sensors (as per Fig 3: "Sensor read data and measured locally")
 * All analog sensors connected via ADS1115 16-bit ADC module (I2C interface)
 */
/**
 * Calculate AQI based on sensor readings (EXACT COPY from backend)
 * Uses research paper Table 2 breakpoints with linear interpolation
 */
function calculateSimpleAQI(co2, co, no2) {
  // Helper function to calculate sub-index
  function calculateSubIndex(concentration, ranges, categoryIndex = 0) {
    const aqiRanges = [
      { min: 0, max: 50 },      // Good
      { min: 51, max: 100 },    // Satisfactory
      { min: 101, max: 150 },   // Moderate
      { min: 151, max: 200 },   // Poor
      { min: 201, max: 300 },   // Very Poor
      { min: 301, max: 500 },   // Severe
    ];

    const range = ranges[categoryIndex];
    const aqiRange = aqiRanges[categoryIndex];
    
    if (concentration < range.min) {
      if (categoryIndex > 0) return calculateSubIndex(concentration, ranges, categoryIndex - 1);
      return aqiRange.min;
    }
    
    if (concentration > range.max) {
      if (categoryIndex < ranges.length - 1) return calculateSubIndex(concentration, ranges, categoryIndex + 1);
      return aqiRange.max;
    }
    
    // Linear interpolation within category
    const concentrationRange = range.max - range.min;
    const aqiRangeSpan = aqiRange.max - aqiRange.min;
    const ratio = (concentration - range.min) / concentrationRange;
    return aqiRange.min + (ratio * aqiRangeSpan);
  }

  // Pollutant ranges as per research paper Table 2
  const co2Ranges = [
    { min: 0, max: 350 },       // Good
    { min: 351, max: 450 },     // Satisfactory
    { min: 451, max: 600 },     // Moderate
    { min: 601, max: 1000 },    // Poor
    { min: 1001, max: 2500 },   // Very Poor
    { min: 2501, max: 5000 },   // Severe
  ];

  const coRanges = [
    { min: 0, max: 0.87 },      // Good
    { min: 0.88, max: 1.75 },   // Satisfactory
    { min: 1.76, max: 8.73 },   // Moderate
    { min: 8.74, max: 14.85 },  // Poor
    { min: 14.86, max: 29.7 },  // Very Poor
    { min: 29.8, max: 100 },    // Severe
  ];

  const no2Ranges = [
    { min: 0, max: 0.021 },     // Good
    { min: 0.022, max: 0.042 }, // Satisfactory
    { min: 0.043, max: 0.095 }, // Moderate
    { min: 0.096, max: 0.149 }, // Poor
    { min: 0.150, max: 0.213 }, // Very Poor
    { min: 0.214, max: 1.0 },   // Severe
  ];

  // Calculate sub-indices for each pollutant
  const co2AQI = calculateSubIndex(co2, co2Ranges);
  const coAQI = calculateSubIndex(co, coRanges);
  const no2AQI = calculateSubIndex(no2, no2Ranges);
  
  // Overall AQI is the maximum of all sub-indices (as per standard practice)
  const overallAQI = Math.max(co2AQI, coAQI, no2AQI);
  
  return Math.round(Math.max(0, Math.min(500, overallAQI))); // Clamp 0-500
}

function readAllSensors() {
  const co2 = readMHZ14_CO2();
  const co = readMiCS4514_CO();
  const no2 = readMiCS4514_NO2();
  const temperature = readLM35_Temperature();
  const humidity = readHIH4030_Humidity();
  
  return {
    co2,
    co,
    no2,
    temperature,
    humidity,
    aqi: calculateSimpleAQI(co2, co, no2)
  };
}

// ============================================
// NETWORK COMMUNICATION (As per Fig 3)
// ============================================

/**
 * Initialize MQTT client
 */
function initializeMQTT() {
  if (!CONFIG.USE_MQTT) return;
  
  console.log(`🔌 [MQTT] Connecting to broker: ${CONFIG.MQTT_BROKER_URL}`);
  
  mqttClient = mqtt.connect(CONFIG.MQTT_BROKER_URL, {
    clientId: `nodemcu_${CONFIG.CHANNEL_ID}_${Date.now()}`,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30000,
  });

  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log(`✅ [MQTT] Connected to broker`);
    console.log(`📡 [MQTT] Will publish to: sensors/${CONFIG.CHANNEL_ID}/readings (QoS ${CONFIG.MQTT_QOS})`);
  });

  mqttClient.on('error', (error) => {
    mqttConnected = false;
    console.error('❌ [MQTT] Connection error:', error.message);
  });

  mqttClient.on('offline', () => {
    mqttConnected = false;
    console.log('⚠️  [MQTT] Client offline');
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 [MQTT] Reconnecting...');
  });
}

/**
 * Send sensor data via MQTT
 */
async function sendDataViaMQTT(data) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttConnected) {
      reject(new Error('MQTT client not connected'));
      return;
    }

    const topic = `sensors/${CONFIG.CHANNEL_ID}/readings`;
    const payload = JSON.stringify({
      channelId: CONFIG.CHANNEL_ID,
      aqi: data.aqi,
      co2: data.co2,
      co: data.co,
      no2: data.no2,
      temperature: data.temperature,
      humidity: data.humidity,
      timestamp: new Date().toISOString(),
    });

    mqttClient.publish(topic, payload, {
      qos: CONFIG.MQTT_QOS,
      retain: false,
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          message: 'Data published via MQTT',
          topic,
          qos: CONFIG.MQTT_QOS,
          size: payload.length,
        });
      }
    });
  });
}

/**
 * Send sensor data to cloud server via HTTP (as per Fig 3: "Transfer data to the cloud via internet")
 */
async function sendDataViaHTTP(data) {
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
        co: data.co,
        no2: data.no2,
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
 * Send data using configured transport (HTTP or MQTT)
 */
async function sendDataToCloud(data) {
  if (CONFIG.USE_MQTT) {
    return await sendDataViaMQTT(data);
  } else {
    return await sendDataViaHTTP(data);
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
    console.log('📡 Reading sensors via ADS1115...');
    const sensorData = readAllSensors();
    console.log(`  MH-Z14 (CO2):    ${sensorData.co2} ppm`);
    console.log(`  MiCS4514 (CO):   ${sensorData.co} ppm`);
    console.log(`  MiCS4514 (NO2):  ${sensorData.no2} ppm`);
    console.log(`  LM35 (Temp):     ${sensorData.temperature}°C`);
    console.log(`  HIH-4030 (Hum):  ${sensorData.humidity}%`);
    
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
    console.log(`☁️  Sending data via ${CONFIG.USE_MQTT ? 'MQTT' : 'HTTP'}...`);
    const result = await sendDataToCloud(sensorData);
    console.log('✅ Data sent successfully!');
    if (CONFIG.USE_MQTT) {
      console.log(`  Topic: ${result.topic}`);
      console.log(`  QoS: ${result.qos}`);
      console.log(`  Size: ${result.size} bytes`);
    } else {
      console.log(`  Calculated AQI: ${result.reading.aqi}`);
      console.log(`  Timestamp: ${result.reading.timestamp}`);
    }
    
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
  console.log('🔧 Hardware Configuration (As per Research Paper Table 1):');
  console.log('   - NodeMCU ESP8266 (WiFi Module, 802.11b/g/n)');
  console.log('   - ADS1115 (16-bit ADC, I2C interface for analog sensors)');
  console.log('   - MH-Z14 CO2 Sensor (350-5000 ppm, 4.5-5.5V)');
  console.log('   - MiCS 4514 CO Sensor (0.88-29.7 ppm, 4.9-5.1V)');
  console.log('   - MiCS 4514 NO2 Sensor (0.022-0.213 ppm, 4.9-5.1V)');
  console.log('   - LM35 Temperature Sensor (-2 to 40°C, 4.9-5.1V)');
  console.log('   - HIH-4030 Humidity Sensor (50-80%, 5.0V)');
  console.log('   - Power Supply: USB 5V');
  console.log('');
  console.log('🌐 Network Configuration:');
  console.log(`   - Transport: ${CONFIG.USE_MQTT ? 'MQTT' : 'HTTP'}`);
  console.log(`   - Server: ${CONFIG.SERVER_URL}`);
  if (CONFIG.USE_MQTT) {
    console.log(`   - MQTT Broker: ${CONFIG.MQTT_BROKER_URL}`);
    console.log(`   - MQTT QoS: ${CONFIG.MQTT_QOS}`);
    console.log(`   - Topic: sensors/${CONFIG.CHANNEL_ID}/readings`);
  }
  console.log(`   - Channel ID: ${CONFIG.CHANNEL_ID || 'NOT SET'}`);
  console.log(`   - Write API Key: ${CONFIG.WRITE_API_KEY ? '••••••••' + CONFIG.WRITE_API_KEY.slice(-4) : 'NOT SET'}`);
  console.log(`   - Send Interval: ${CONFIG.SEND_INTERVAL / 1000}s`);
  console.log('');
  
  // Initialize MQTT if enabled
  if (CONFIG.USE_MQTT) {
    initializeMQTT();
    // Wait a bit for MQTT connection
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

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
