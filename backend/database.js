// Simple JSON-based database for IoT Air Quality Monitoring System
// Stores users, channels, and sensor readings

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize database structure
let db = {
  users: [],
  channels: [],
  readings: []
};

// Load database from file
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading database:', error.message);
  }
}

// Save database to file
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database:', error.message);
  }
}

// Generate unique ID
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Generate API keys
function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

// Hash password (simple hash for demo - use bcrypt in production)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// User Management
const users = {
  create: (username, email, password) => {
    const existingUser = db.users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = {
      id: generateId('user'),
      username,
      email,
      password: hashPassword(password),
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    saveDatabase();
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  authenticate: (email, password) => {
    const user = db.users.find(u => u.email === email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.password !== hashPassword(password)) {
      throw new Error('Invalid credentials');
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  findById: (userId) => {
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  findByEmail: (email) => {
    const user = db.users.find(u => u.email === email);
    if (!user) return null;
    
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
};

// Channel Management
const channels = {
  create: (userId, name, description = '', isPublic = false, location = null) => {
    // Sanitize location data for public channels - remove exact coordinates
    let sanitizedLocation = null;
    if (location && isPublic) {
      // Round coordinates to 3 decimal places (~100m accuracy) for privacy
      // This prevents exact address tracking while keeping general area
      sanitizedLocation = {
        latitude: Math.round(location.latitude * 1000) / 1000,
        longitude: Math.round(location.longitude * 1000) / 1000,
        generalLocation: location.generalLocation
      };
    } else if (location) {
      sanitizedLocation = location;
    }

    const channel = {
      id: generateId('channel'),
      userId,
      name,
      description,
      isPublic: isPublic || false,
      location: sanitizedLocation, // { latitude, longitude, generalLocation }
      readApiKey: generateApiKey(),
      writeApiKey: generateApiKey(),
      createdAt: new Date().toISOString(),
      fields: {
        field1: 'AQI',
        field2: 'CO2',
        field3: 'Temperature',
        field4: 'Humidity'
      }
    };

    db.channels.push(channel);
    saveDatabase();
    return channel;
  },

  findById: (channelId) => {
    return db.channels.find(c => c.id === channelId);
  },

  findByUser: (userId) => {
    return db.channels.filter(c => c.userId === userId);
  },

  findPublic: () => {
    // Return public channels with anonymized data (no userId, no API keys exposed)
    return db.channels
      .filter(c => c.isPublic === true)
      .map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        // Location is already sanitized (rounded coordinates + area/neighborhood only)
        location: c.location ? {
          latitude: c.location.latitude,
          longitude: c.location.longitude,
          generalLocation: c.location.generalLocation
        } : null,
        createdAt: c.createdAt,
        fields: c.fields
        // Security: userId, readApiKey, writeApiKey are intentionally omitted
        // This ensures complete anonymity - no way to trace channel to user
      }));
  },

  findByApiKey: (apiKey) => {
    return db.channels.find(c => c.readApiKey === apiKey || c.writeApiKey === apiKey);
  },

  validateWriteKey: (channelId, apiKey) => {
    const channel = db.channels.find(c => c.id === channelId);
    return channel && channel.writeApiKey === apiKey;
  },

  validateReadKey: (channelId, apiKey) => {
    const channel = db.channels.find(c => c.id === channelId);
    return channel && channel.readApiKey === apiKey;
  },

  delete: (channelId, userId) => {
    const channelIndex = db.channels.findIndex(c => c.id === channelId && c.userId === userId);
    if (channelIndex === -1) {
      throw new Error('Channel not found or unauthorized');
    }

    db.channels.splice(channelIndex, 1);
    // Also delete all readings for this channel
    db.readings = db.readings.filter(r => r.channelId !== channelId);
    saveDatabase();
  }
};

// Readings Management
const readings = {
  create: (channelId, data) => {
    const reading = {
      id: generateId('reading'),
      channelId,
      timestamp: new Date().toISOString(),
      aqi: data.aqi,
      co2: data.co2,
      co: data.co || 0,
      no2: data.no2 || 0,
      temperature: data.temperature,
      humidity: data.humidity
    };

    db.readings.push(reading);
    
    // Keep only last 10000 readings per channel
    const channelReadings = db.readings.filter(r => r.channelId === channelId);
    if (channelReadings.length > 10000) {
      const toRemove = channelReadings.length - 10000;
      const oldestReadings = channelReadings.slice(0, toRemove);
      db.readings = db.readings.filter(r => !oldestReadings.includes(r));
    }
    
    saveDatabase();
    return reading;
  },

  findByChannel: (channelId, limit = 50) => {
    return db.readings
      .filter(r => r.channelId === channelId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  },

  findByTimeRange: (channelId, startTime, endTime) => {
    let channelReadings = db.readings.filter(r => r.channelId === channelId);
    
    if (startTime) {
      const start = new Date(startTime);
      channelReadings = channelReadings.filter(r => new Date(r.timestamp) >= start);
    }
    
    if (endTime) {
      const end = new Date(endTime);
      channelReadings = channelReadings.filter(r => new Date(r.timestamp) <= end);
    }
    
    return channelReadings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  getLatest: (channelId) => {
    const channelReadings = db.readings
      .filter(r => r.channelId === channelId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return channelReadings[0] || null;
  },

  deleteByChannel: (channelId) => {
    db.readings = db.readings.filter(r => r.channelId !== channelId);
    saveDatabase();
  }
};

// Statistics
const stats = {
  getOverview: () => {
    return {
      totalUsers: db.users.length,
      totalChannels: db.channels.length,
      totalReadings: db.readings.length
    };
  }
};

// Initialize database on module load
loadDatabase();

module.exports = {
  users,
  channels,
  readings,
  stats,
  loadDatabase,
  saveDatabase
};
