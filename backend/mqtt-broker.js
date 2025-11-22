/**
 * MQTT Broker for IoT Air Quality Monitoring System
 * Uses Aedes - Pure Node.js MQTT broker
 * 
 * Features:
 * - MQTT v3.1.1 and v5.0 support
 * - QoS 0, 1, 2 support
 * - Retained messages
 * - Authentication (optional)
 * - WebSocket support for web clients
 * - Performance metrics tracking
 */

const aedes = require('aedes')();
const net = require('net');
const http = require('http');
const ws = require('ws');

const MQTT_PORT = 1883;
const MQTT_WS_PORT = 8883;

// Statistics tracking
const stats = {
  clients: 0,
  messagesReceived: 0,
  messagesPublished: 0,
  bytesReceived: 0,
  bytesPublished: 0,
  startTime: new Date(),
  qos0: 0,
  qos1: 0,
  qos2: 0,
};

// Client tracking
const connectedClients = new Map();

// Authentication (optional - can be disabled)
aedes.authenticate = (client, username, password, callback) => {
  // For now, allow all connections
  // In production, implement proper authentication
  console.log(`🔐 Client ${client.id} authenticating...`);
  callback(null, true);
};

// Authorization
aedes.authorizePublish = (client, packet, callback) => {
  // Allow publishing to sensors/* topics
  if (packet.topic.startsWith('sensors/')) {
    stats.messagesPublished++;
    stats.bytesPublished += packet.payload.length;
    
    // Track QoS
    if (packet.qos === 0) stats.qos0++;
    else if (packet.qos === 1) stats.qos1++;
    else if (packet.qos === 2) stats.qos2++;
    
    callback(null);
  } else {
    callback(new Error('Unauthorized topic'));
  }
};

aedes.authorizeSubscribe = (client, sub, callback) => {
  // Allow subscribing to sensors/* topics
  if (sub.topic.startsWith('sensors/') || sub.topic === 'sensors/#') {
    callback(null, sub);
  } else {
    callback(new Error('Unauthorized subscription'));
  }
};

// Event handlers
aedes.on('client', (client) => {
  stats.clients++;
  connectedClients.set(client.id, {
    id: client.id,
    connectedAt: new Date(),
    messagesReceived: 0,
    messagesPublished: 0,
  });
  console.log(`✅ [MQTT] Client connected: ${client.id} (Total: ${stats.clients})`);
});

aedes.on('clientDisconnect', (client) => {
  stats.clients--;
  const clientInfo = connectedClients.get(client.id);
  if (clientInfo) {
    console.log(`❌ [MQTT] Client disconnected: ${client.id}`);
    console.log(`   Duration: ${Math.round((Date.now() - clientInfo.connectedAt.getTime()) / 1000)}s`);
    console.log(`   Messages: ${clientInfo.messagesPublished} published, ${clientInfo.messagesReceived} received`);
    connectedClients.delete(client.id);
  }
});

aedes.on('publish', (packet, client) => {
  if (client) {
    stats.messagesReceived++;
    stats.bytesReceived += packet.payload.length;
    
    const clientInfo = connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.messagesPublished++;
    }
    
    // Log sensor data publications
    if (packet.topic.startsWith('sensors/')) {
      try {
        const data = JSON.parse(packet.payload.toString());
        console.log(`📨 [MQTT] Published to ${packet.topic} (QoS ${packet.qos})`);
        console.log(`   From: ${client.id}`);
        console.log(`   AQI: ${data.aqi || 'N/A'} | Size: ${packet.payload.length} bytes`);
      } catch (e) {
        // Not JSON, skip
      }
    }
  }
});

aedes.on('subscribe', (subscriptions, client) => {
  subscriptions.forEach(sub => {
    console.log(`📡 [MQTT] Client ${client.id} subscribed to: ${sub.topic} (QoS ${sub.qos})`);
    
    const clientInfo = connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.messagesReceived++;
    }
  });
});

aedes.on('unsubscribe', (subscriptions, client) => {
  subscriptions.forEach(topic => {
    console.log(`📡 [MQTT] Client ${client.id} unsubscribed from: ${topic}`);
  });
});

// Create MQTT server (TCP)
const mqttServer = net.createServer(aedes.handle);

mqttServer.listen(MQTT_PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   MQTT Broker - IoT Air Quality Monitoring System             ║');
  console.log('║   Powered by Aedes                                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 MQTT Broker running on:`);
  console.log(`   TCP: mqtt://0.0.0.0:${MQTT_PORT}`);
  console.log(`   Mobile: mqtt://192.168.1.12:${MQTT_PORT}`);
  console.log('');
  console.log('📋 Supported Features:');
  console.log('   - MQTT v3.1.1 and v5.0');
  console.log('   - QoS 0, 1, 2');
  console.log('   - Retained messages');
  console.log('   - Wildcard subscriptions');
  console.log('');
  console.log('📡 Topic Structure:');
  console.log('   Publish: sensors/<channelId>/readings');
  console.log('   Subscribe: sensors/# (all channels)');
  console.log('   Subscribe: sensors/<channelId>/# (specific channel)');
  console.log('');
  console.log('✅ Broker ready! Waiting for MQTT clients...');
  console.log('');
});

// Create MQTT over WebSocket server
const httpServer = http.createServer();
const wsServer = new ws.Server({ server: httpServer });

wsServer.on('connection', (stream) => {
  console.log('🔌 [MQTT-WS] WebSocket client connected');
  aedes.handle(stream);
});

httpServer.listen(MQTT_WS_PORT, () => {
  console.log(`🔌 MQTT over WebSocket running on: ws://0.0.0.0:${MQTT_WS_PORT}`);
  console.log('');
});

// Statistics API (can be called from main server)
function getStats() {
  const uptime = Math.round((Date.now() - stats.startTime.getTime()) / 1000);
  return {
    ...stats,
    uptime,
    connectedClients: Array.from(connectedClients.values()),
    messagesPerSecond: stats.messagesReceived / Math.max(uptime, 1),
    bytesPerSecond: stats.bytesReceived / Math.max(uptime, 1),
  };
}

// Expose stats endpoint
setInterval(() => {
  const statsData = getStats();
  // Publish stats to stats/broker topic for monitoring
  aedes.publish({
    topic: 'stats/broker',
    payload: JSON.stringify({
      clients: statsData.clients,
      messages: statsData.messagesReceived,
      uptime: statsData.uptime,
      qos: {
        qos0: stats.qos0,
        qos1: stats.qos1,
        qos2: stats.qos2,
      }
    }),
    qos: 0,
    retain: true,
  });
}, 10000); // Every 10 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down MQTT broker...');
  const statsData = getStats();
  console.log('\n📊 Final Statistics:');
  console.log(`   Total clients: ${statsData.clients}`);
  console.log(`   Messages received: ${statsData.messagesReceived}`);
  console.log(`   Messages published: ${statsData.messagesPublished}`);
  console.log(`   Data received: ${(statsData.bytesReceived / 1024).toFixed(2)} KB`);
  console.log(`   Data published: ${(statsData.bytesPublished / 1024).toFixed(2)} KB`);
  console.log(`   QoS 0: ${stats.qos0} | QoS 1: ${stats.qos1} | QoS 2: ${stats.qos2}`);
  console.log(`   Uptime: ${statsData.uptime}s`);
  console.log('');
  
  aedes.close(() => {
    mqttServer.close(() => {
      httpServer.close(() => {
        console.log('✅ MQTT broker stopped gracefully');
        process.exit(0);
      });
    });
  });
});

module.exports = { aedes, getStats };
