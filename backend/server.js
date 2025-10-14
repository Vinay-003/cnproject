// Simple simulated IoT air quality backend server
// Run with: npm run start:api
// Mobile app endpoint: GET /api/air-quality/latest?limit=50

const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const GENERATE_INTERVAL_MS = 10_000; // every 10s a new reading arrives
const MAX_HISTORY = 5000;

/** In-memory readings store (oldest -> newest) */
const readings = [];

function randomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateReading() {
  const baseAQI = randomFloat(20, 160, 0);
  const reading = {
    timestamp: new Date().toISOString(),
    aqi: baseAQI,
    co2: randomFloat(400, 1200, 0), // ppm
    temperature: randomFloat(18, 32, 1), // °C
    humidity: randomFloat(30, 85, 1), // %
  };
  readings.push(reading);
  if (readings.length > MAX_HISTORY) readings.splice(0, readings.length - MAX_HISTORY);
  return reading;
}
// Pre-generate some history
for (let i = 0; i < 120; i++) {
  const r = generateReading();
  r.timestamp = new Date(Date.now() - (120 - i) * GENERATE_INTERVAL_MS).toISOString();
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

app.listen(PORT, () => {
  console.log(`Simulated air quality backend listening on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/air-quality/latest?limit=50`);
  console.log(`  POST /api/air-quality { aqi, co2, temperature, humidity }`);
  console.log(`  GET  /api/health`);
});
// Periodically generate a new reading
setInterval(() => {
  const r = generateReading();
  process.stdout.write(`Generated reading AQI=${r.aqi} CO2=${r.co2} Temp=${r.temperature}C Hum=${r.humidity}%\n`);
}, GENERATE_INTERVAL_MS);

