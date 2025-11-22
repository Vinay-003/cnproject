// IoT Air Quality Monitoring System Backend Server
// Based on research paper architecture (Fig 1, 3, 4, 5)
// Run with: npm run start:api

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');
const { initializeMQTTSubscriber, getSubscriberStats } = require('./mqtt-subscriber');

const PORT = process.env.PORT || 3000;
const GENERATE_INTERVAL_MS = 10_000; // every 10s a new reading arrives
const MAX_HISTORY = 5000;

/** In-memory readings store (oldest -> newest) */
const readings = [];

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/**
 * Calculate detailed AQI based on research paper Table 2
 * Implements the method from "IoT Based Design of Air Quality Monitoring System" by Purkayastha et al.
 * 
 * AQI Categories as per research paper:
 * 0-50: Good
 * 51-100: Satisfactory
 * 101-150: Moderate
 * 151-200: Poor
 * 201-300: Very Poor
 * 301-500: Severe
 */
function calculateAQI(co2, co, no2, temperature, humidity) {
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
const server = http.createServer(app);

// Initialize Socket.IO for WebSocket support
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// WebSocket connection tracking
let wsConnections = 0;
const channelRooms = new Map(); // channelId -> Set of socket IDs

io.on('connection', (socket) => {
  wsConnections++;
  console.log(`🔌 WebSocket client connected (ID: ${socket.id}) - Total: ${wsConnections}`);
  
  // Join channel room for real-time updates
  socket.on('join-channel', (channelId) => {
    socket.join(`channel:${channelId}`);
    if (!channelRooms.has(channelId)) {
      channelRooms.set(channelId, new Set());
    }
    channelRooms.get(channelId).add(socket.id);
    console.log(`📡 Client ${socket.id} joined channel: ${channelId}`);
    socket.emit('joined', { channelId, timestamp: new Date().toISOString() });
  });
  
  // Leave channel room
  socket.on('leave-channel', (channelId) => {
    socket.leave(`channel:${channelId}`);
    if (channelRooms.has(channelId)) {
      channelRooms.get(channelId).delete(socket.id);
      if (channelRooms.get(channelId).size === 0) {
        channelRooms.delete(channelId);
      }
    }
    console.log(`📡 Client ${socket.id} left channel: ${channelId}`);
  });
  
  socket.on('disconnect', () => {
    wsConnections--;
    // Clean up channel rooms
    channelRooms.forEach((sockets, channelId) => {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          channelRooms.delete(channelId);
        }
      }
    });
    console.log(`🔌 WebSocket client disconnected (ID: ${socket.id}) - Total: ${wsConnections}`);
  });
});

// Initialize MQTT subscriber (connects to MQTT broker)
initializeMQTTSubscriber(io);

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', readings: readings.length });
});

// WebSocket statistics endpoint
app.get('/api/websocket/stats', (_req, res) => {
  const rooms = {};
  channelRooms.forEach((sockets, channelId) => {
    rooms[channelId] = sockets.size;
  });
  
  res.json({
    connections: wsConnections,
    activeChannelRooms: channelRooms.size,
    rooms,
    timestamp: new Date().toISOString()
  });
});

// MQTT subscriber statistics endpoint
app.get('/api/mqtt/stats', (_req, res) => {
  const stats = getSubscriberStats();
  res.json(stats);
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
    const { userId, name, description, isPublic, location } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' });
    }

    // Validate user exists
    const user = db.users.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const channel = db.channels.create(userId, name, description, isPublic, location);
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

// Get all public channels (anonymous access)
app.get('/api/channels/public', (req, res) => {
  const publicChannels = db.channels.findPublic();
  res.json({ channels: publicChannels });
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
    const channelId = req.params.channelId;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Stop simulator if running for this channel
    if (runningSimulators.has(channelId)) {
      const simulatorInfo = runningSimulators.get(channelId);
      try {
        simulatorInfo.process.kill();
        runningSimulators.delete(channelId);
        console.log(`[Server] Stopped simulator for deleted channel: ${channelId}`);
      } catch (killError) {
        console.warn(`[Server] Failed to stop simulator for channel ${channelId}:`, killError.message);
      }
    }

    db.channels.delete(channelId, userId);
    res.json({ 
      message: 'Channel deleted successfully',
      simulatorStopped: runningSimulators.has(channelId) ? false : true
    });
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
    const { channelId, writeApiKey, co2, co = 0, no2 = 0, temperature, humidity } = req.body;
    
    if (!channelId || !writeApiKey) {
      return res.status(400).json({ error: 'channelId and writeApiKey required' });
    }

    // Validate API key (as per Fig 3)
    if (!db.channels.validateWriteKey(channelId, writeApiKey)) {
      return res.status(401).json({ error: 'Invalid channel ID or API key' });
    }
    
    // Validate sensor data
    if (typeof co2 !== 'number' || typeof temperature !== 'number' || typeof humidity !== 'number') {
      return res.status(400).json({ error: 'Invalid sensor data - co2, temperature, humidity are required' });
    }

    // Calculate AQI from sensor readings (as per research paper)
    const aqi = calculateAQI(co2, co, no2, temperature, humidity);

    // Store reading with all sensor data
    const reading = db.readings.create(channelId, {
      aqi,
      co2,
      co,
      no2,
      temperature,
      humidity
    });

    // Emit real-time update via WebSocket to all clients in the channel room
    const roomName = `channel:${channelId}`;
    const clientsInRoom = io.sockets.adapter.rooms.get(roomName);
    if (clientsInRoom && clientsInRoom.size > 0) {
      io.to(roomName).emit('newReading', {
        channelId,
        reading,
        timestamp: new Date().toISOString(),
        serverTransmitTime: Date.now() // For accurate latency calculation
      });
      console.log(`📤 WebSocket: Emitted newReading to ${clientsInRoom.size} clients in ${roomName}`);
    }

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
    const { readApiKey, limit = 50, startTime, endTime } = req.query;

    // Validate channel exists
    const channel = db.channels.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Allow public access to public channels without API key
    if (channel.isPublic) {
      let readings;
      
      // If time range is provided, filter by time
      if (startTime || endTime) {
        readings = db.readings.findByTimeRange(
          channelId, 
          startTime ? new Date(startTime) : null,
          endTime ? new Date(endTime) : null
        );
      } else {
        readings = db.readings.findByChannel(channelId, parseInt(limit));
      }
      
      return res.json({ readings });
    }

    // Validate read API key for private channels
    if (readApiKey && !db.channels.validateReadKey(channelId, readApiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    let readings;
    
    // If time range is provided, filter by time
    if (startTime || endTime) {
      readings = db.readings.findByTimeRange(
        channelId, 
        startTime ? new Date(startTime) : null,
        endTime ? new Date(endTime) : null
      );
    } else {
      readings = db.readings.findByChannel(channelId, parseInt(limit));
    }
    
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

    // Allow public access to public channels
    if (channel.isPublic) {
      const reading = db.readings.getLatest(channelId);
      return res.json({ reading });
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
// ============================================
// SIMULATOR MANAGEMENT ENDPOINTS
// ============================================

const { spawn } = require('child_process');
const path = require('path');

// Track running simulators
const runningSimulators = new Map(); // channelId -> { process, startTime }

// Start simulator for a channel
app.post('/api/simulator/start', (req, res) => {
  const { channelId, writeApiKey, serverUrl, useMqtt, mqttBrokerUrl, mqttQos } = req.body;

  if (!channelId || !writeApiKey) {
    return res.status(400).json({ error: 'channelId and writeApiKey required' });
  }

  // Check if simulator already running for this channel
  if (runningSimulators.has(channelId)) {
    return res.status(400).json({ 
      error: 'Simulator already running for this channel',
      status: 'already_running'
    });
  }

  try {
    const simulatorPath = path.join(__dirname, '..', 'simulator', 'nodemcu.js');
    const actualServerUrl = serverUrl || `http://localhost:${PORT}`;

    // Build environment variables
    const envVars = {
      ...process.env,
      CHANNEL_ID: channelId,
      WRITE_API_KEY: writeApiKey,
      SERVER_URL: actualServerUrl,
    };

    // Add MQTT config if enabled
    if (useMqtt) {
      envVars.USE_MQTT = 'true';
      envVars.MQTT_BROKER_URL = mqttBrokerUrl || 'mqtt://localhost:1883';
      envVars.MQTT_QOS = String(mqttQos !== undefined ? mqttQos : 1);
    }

    console.log(`🚀 Starting simulator for channel ${channelId}`);
    console.log(`   Transport: ${useMqtt ? `MQTT (QoS ${mqttQos})` : 'HTTP'}`);

    // Spawn the simulator process
    const simulatorProcess = spawn('node', [simulatorPath], {
      env: envVars,
      detached: false, // Keep attached to parent process
      stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr
    });

    // Store process reference
    runningSimulators.set(channelId, {
      process: simulatorProcess,
      startTime: new Date().toISOString(),
      pid: simulatorProcess.pid
    });

    console.log(`🚀 Started simulator for channel ${channelId} (PID: ${simulatorProcess.pid})`);

    // Handle process output
    simulatorProcess.stdout.on('data', (data) => {
      console.log(`[Simulator ${channelId}] ${data.toString().trim()}`);
    });

    simulatorProcess.stderr.on('data', (data) => {
      console.error(`[Simulator ${channelId} ERROR] ${data.toString().trim()}`);
    });

    // Handle process exit
    simulatorProcess.on('exit', (code, signal) => {
      console.log(`🛑 Simulator for channel ${channelId} stopped (code: ${code}, signal: ${signal})`);
      runningSimulators.delete(channelId);
    });

    // Handle process errors
    simulatorProcess.on('error', (err) => {
      console.error(`❌ Simulator error for channel ${channelId}:`, err);
      runningSimulators.delete(channelId);
    });

    res.json({
      success: true,
      message: 'Simulator started successfully',
      channelId,
      pid: simulatorProcess.pid,
      startTime: runningSimulators.get(channelId).startTime
    });

  } catch (error) {
    console.error('Failed to start simulator:', error);
    res.status(500).json({ error: 'Failed to start simulator: ' + error.message });
  }
});

// Stop simulator for a channel
app.post('/api/simulator/stop', (req, res) => {
  const { channelId } = req.body;

  if (!channelId) {
    return res.status(400).json({ error: 'channelId required' });
  }

  const simulator = runningSimulators.get(channelId);
  if (!simulator) {
    return res.status(404).json({ error: 'No simulator running for this channel' });
  }

  try {
    // Kill the process
    simulator.process.kill('SIGTERM');
    runningSimulators.delete(channelId);

    console.log(`🛑 Stopped simulator for channel ${channelId}`);

    res.json({
      success: true,
      message: 'Simulator stopped successfully',
      channelId
    });

  } catch (error) {
    console.error('Failed to stop simulator:', error);
    res.status(500).json({ error: 'Failed to stop simulator: ' + error.message });
  }
});

// Get simulator status
app.get('/api/simulator/status/:channelId', (req, res) => {
  const { channelId } = req.params;
  const simulator = runningSimulators.get(channelId);

  if (!simulator) {
    return res.json({
      running: false,
      channelId
    });
  }

  res.json({
    running: true,
    channelId,
    pid: simulator.pid,
    startTime: simulator.startTime,
    uptime: Date.now() - new Date(simulator.startTime).getTime()
  });
});

// Get all running simulators
app.get('/api/simulator/list', (req, res) => {
  const simulators = Array.from(runningSimulators.entries()).map(([channelId, sim]) => ({
    channelId,
    pid: sim.pid,
    startTime: sim.startTime,
    uptime: Date.now() - new Date(sim.startTime).getTime()
  }));

  res.json({
    count: simulators.length,
    simulators
  });
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  console.log('🧹 Stopping all running simulators...');
  
  for (const [channelId, simulator] of runningSimulators.entries()) {
    try {
      simulator.process.kill('SIGTERM');
      console.log(`   ✓ Stopped simulator for ${channelId}`);
    } catch (err) {
      console.error(`   ✗ Failed to stop simulator for ${channelId}`);
    }
  }
  
  runningSimulators.clear();
  process.exit(0);
});

// START SERVER
// ============================================

server.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   IoT Air Quality Monitoring System - Backend Server          ║');
  console.log('║   Based on Research Paper Architecture + WebSocket Support     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 HTTP Server running on: http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket Server running on: ws://0.0.0.0:${PORT}`);
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
  console.log('    GET    /api/channels/public (anonymous access)');
  console.log('    GET    /api/channels/:channelId');
  console.log('    DELETE /api/channels/:channelId');
  console.log('');
  console.log('  Sensor Data (Fig 3 & Fig 4):');
  console.log('    POST /api/sensor-data');
  console.log('    GET  /api/channels/:channelId/readings');
  console.log('    GET  /api/channels/:channelId/latest');
  console.log('');
  console.log('  Simulator Management:');
  console.log('    POST /api/simulator/start');
  console.log('    POST /api/simulator/stop');
  console.log('    GET  /api/simulator/status/:channelId');
  console.log('    GET  /api/simulator/list');
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

