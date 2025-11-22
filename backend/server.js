// IoT Air Quality Monitoring System Backend Server
// Based on research paper architecture (Fig 1, 3, 4, 5)
// Run with: npm run start:api

const express = require('express');
const cors = require('cors');
const db = require('./database');

const PORT = process.env.PORT || 3000;
const GENERATE_INTERVAL_MS = 10_000; // every 10s a new reading arrives
const MAX_HISTORY = 5000;

/** In-memory readings store (oldest -> newest) */
const readings = [];

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/**
 * Calculate AQI based on CO2, temperature, and humidity sensor readings
 * Based on standard air quality index calculations adapted for IoT sensors
 * 
 * AQI Categories:
 * 0-50: Good (Green)
 * 51-100: Moderate (Yellow)
 * 101-150: Unhealthy for Sensitive Groups (Orange)
 * 151-200: Unhealthy (Red)
 * 201-300: Very Unhealthy (Purple)
 * 300+: Hazardous (Maroon)
 */
function calculateAQI(co2, temperature, humidity) {
  let aqiScore = 0;
  
  // CO2 contribution (most significant factor)
  // Good air: 400-600 ppm, Moderate: 600-1000, Poor: 1000+
  if (co2 <= 600) {
    aqiScore += (co2 - 400) / 200 * 25; // 0-25
  } else if (co2 <= 1000) {
    aqiScore += 25 + (co2 - 600) / 400 * 50; // 25-75
  } else if (co2 <= 1500) {
    aqiScore += 75 + (co2 - 1000) / 500 * 75; // 75-150
  } else {
    aqiScore += 150 + Math.min((co2 - 1500) / 500 * 150, 150); // 150-300
  }
  
  // Temperature contribution (comfort range: 20-26°C)
  const tempDeviation = Math.abs(temperature - 23); // 23°C is optimal
  if (tempDeviation <= 3) {
    aqiScore += tempDeviation * 5; // 0-15
  } else {
    aqiScore += 15 + (tempDeviation - 3) * 10; // 15+
  }
  
  // Humidity contribution (ideal: 40-60%)
  if (humidity >= 40 && humidity <= 60) {
    aqiScore += 0; // Ideal range
  } else if (humidity < 40) {
    aqiScore += (40 - humidity) / 2; // Too dry
  } else {
    aqiScore += (humidity - 60) / 2; // Too humid
  }
  
  return Math.round(Math.max(0, Math.min(500, aqiScore))); // Clamp 0-500
}

// Simulated sensor with realistic baseline and small variations
let sensorState = {
  co2: 450,        // Start with good air quality
  temperature: 24, // Comfortable temperature
  humidity: 50     // Ideal humidity
};

function generateReading() {
  // Simulate realistic sensor variations (gradual changes, not random jumps)
  sensorState.co2 += randomFloat(-30, 30, 0);
  sensorState.co2 = Math.max(400, Math.min(1500, sensorState.co2)); // Clamp 400-1500
  
  sensorState.temperature += randomFloat(-0.5, 0.5, 1);
  sensorState.temperature = Math.max(18, Math.min(35, sensorState.temperature)); // Clamp 18-35
  
  sensorState.humidity += randomFloat(-2, 2, 1);
  sensorState.humidity = Math.max(30, Math.min(85, sensorState.humidity)); // Clamp 30-85
  
  const co2 = Math.round(sensorState.co2);
  const temperature = Math.round(sensorState.temperature * 10) / 10;
  const humidity = Math.round(sensorState.humidity * 10) / 10;
  const aqi = calculateAQI(co2, temperature, humidity);
  
  const reading = {
    timestamp: new Date().toISOString(),
    aqi,
    co2,
    temperature,
    humidity
  };
  
  readings.push(reading);
  if (readings.length > MAX_HISTORY) readings.splice(0, readings.length - MAX_HISTORY);
  return reading;
}

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', readings: readings.length });
});

// Return latest readings. Query: limit (default 50)
app.get('/api/air-quality/latest', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const slice = readings.slice(-limit);
  res.json(slice);
});

// Accept a pushed reading from a (simulated) device
// Body: { aqi, co2, temperature, humidity, timestamp? }
app.post('/api/air-quality', (req, res) => {
  const { aqi, co2, temperature, humidity, timestamp } = req.body || {};
  if ([aqi, co2, temperature, humidity].some(v => typeof v !== 'number')) {
    return res.status(400).json({ error: 'Invalid reading payload' });
  }
  const reading = {
    timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    aqi, co2, temperature, humidity,
  };
  readings.push(reading);
  if (readings.length > MAX_HISTORY) readings.splice(0, readings.length - MAX_HISTORY);
  res.status(201).json(reading);
});
// Clear all readings (for testing)
app.post('/api/reset', (_req, res) => {
  readings.length = 0;
  res.json({ status: 'cleared' });
});

// ============================================
// AUTHENTICATION ENDPOINTS (As per Fig 5)
// ============================================

// Register new user
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = db.users.create(username, email, password);
    res.status(201).json({ 
      message: 'User registered successfully',
      user 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login user
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.users.authenticate(email, password);
    res.json({ 
      message: 'Login successful',
      user 
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/auth/profile/:userId', (req, res) => {
  const user = db.users.findById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// ============================================
// CHANNEL MANAGEMENT ENDPOINTS (As per Fig 5 & Fig 8)
// ============================================

// Create new channel (Fig 8 flow)
app.post('/api/channels/create', (req, res) => {
  try {
    const { userId, name, description } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }

    // Validate user exists
    const user = db.users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const channel = db.channels.create(userId, name, description);
    res.status(201).json({ 
      message: 'Channel created successfully',
      channel 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all channels for a user
app.get('/api/channels/user/:userId', (req, res) => {
  const channels = db.channels.findByUser(req.params.userId);
  res.json({ channels });
});

// Get specific channel details
app.get('/api/channels/:channelId', (req, res) => {
  const channel = db.channels.findById(req.params.channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json({ channel });
});

// Delete channel
app.delete('/api/channels/:channelId', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    db.channels.delete(req.params.channelId, userId);
    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// SENSOR DATA ENDPOINTS (As per Fig 3 & Fig 4)
// ============================================

// Receive sensor data from NodeMCU (Fig 3 flow)
app.post('/api/sensor-data', (req, res) => {
  try {
    const { channelId, writeApiKey, co2, temperature, humidity } = req.body;
    
    if (!channelId || !writeApiKey) {
      return res.status(400).json({ error: 'channelId and writeApiKey required' });
    }

    // Validate API key (as per Fig 3)
    if (!db.channels.validateWriteKey(channelId, writeApiKey)) {
      return res.status(401).json({ error: 'Invalid channel ID or API key' });
    }

    // Validate sensor data
    if (typeof co2 !== 'number' || typeof temperature !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({ error: 'Invalid sensor data' });
    }

    // Calculate AQI from sensor readings
    const aqi = calculateAQI(co2, temperature, humidity);

    // Store reading
    const reading = db.readings.create(channelId, {
      aqi,
      co2,
      temperature,
      humidity
    });

    res.status(201).json({ 
      message: 'Data received successfully',
      reading 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get latest readings for a channel (for mobile app)
app.get('/api/channels/:channelId/readings', (req, res) => {
  try {
    const { channelId } = req.params;
    const { readApiKey, limit = 50 } = req.query;

    // Validate channel exists
    const channel = db.channels.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Validate read API key (optional for demo, but follows paper)
    if (readApiKey && !db.channels.validateReadKey(channelId, readApiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const readings = db.readings.findByChannel(channelId, parseInt(limit));
    res.json({ readings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get latest single reading for a channel
app.get('/api/channels/:channelId/latest', (req, res) => {
  try {
    const { channelId } = req.params;
    const { readApiKey } = req.query;

    const channel = db.channels.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (readApiKey && !db.channels.validateReadKey(channelId, readApiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const reading = db.readings.getLatest(channelId);
    res.json({ reading });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// LEGACY ENDPOINTS (backward compatibility)
// ============================================

// Old endpoint - still works for testing
app.get('/api/air-quality/latest', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const slice = readings.slice(-limit);
  res.json(slice);
});

app.post('/api/air-quality', (req, res) => {
  const { aqi, co2, temperature, humidity, timestamp } = req.body || {};
  if ([aqi, co2, temperature, humidity].some(v => typeof v !== 'number')) {
    return res.status(400).json({ error: 'Invalid reading payload' });
  }
  const reading = {
    timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    aqi, co2, temperature, humidity,
  };
  readings.push(reading);
  if (readings.length > MAX_HISTORY) readings.splice(0, readings.length - MAX_HISTORY);
  res.status(201).json(reading);
});

// ============================================
// UTILITY ENDPOINTS
// ============================================

app.get('/api/stats', (_req, res) => {
  res.json(db.stats.getOverview());
});

app.post('/api/reset', (_req, res) => {
  readings.length = 0;
  res.json({ status: 'cleared' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   IoT Air Quality Monitoring System - Backend Server          ║');
  console.log('║   Based on Research Paper Architecture                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile access: http://192.168.1.12:${PORT}`);
  console.log('');
  console.log('📊 API Endpoints:');
  console.log('');
  console.log('  Authentication (Fig 5):');
  console.log('    POST /api/auth/register');
  console.log('    POST /api/auth/login');
  console.log('    GET  /api/auth/profile/:userId');
  console.log('');
  console.log('  Channel Management (Fig 8):');
  console.log('    POST   /api/channels/create');
  console.log('    GET    /api/channels/user/:userId');
  console.log('    GET    /api/channels/:channelId');
  console.log('    DELETE /api/channels/:channelId');
  console.log('');
  console.log('  Sensor Data (Fig 3 & Fig 4):');
  console.log('    POST /api/sensor-data');
  console.log('    GET  /api/channels/:channelId/readings');
  console.log('    GET  /api/channels/:channelId/latest');
  console.log('');
  console.log('  System:');
  console.log('    GET  /api/health');
  console.log('    GET  /api/stats');
  console.log('');
  console.log('✅ Server ready! Waiting for NodeMCU simulator or mobile app...');
  console.log('');
  console.log('💡 Note: No demo data will be generated automatically.');
  console.log('   Start the NodeMCU simulator to send real sensor data!');
  console.log('');
});

