/**
 * MQTT Subscriber for Backend Server
 * Subscribes to sensor data topics and integrates with database
 * Forwards received data to WebSocket clients for real-time updates
 */

const mqtt = require('mqtt');
const db = require('./database');

const MQTT_BROKER_URL = 'mqtt://localhost:1883';
const SUBSCRIBE_TOPIC = 'sensors/#'; // Subscribe to all sensor channels

let mqttClient = null;
let io = null; // Socket.IO instance (set from server.js)
let stats = {
  connected: false,
  messagesReceived: 0,
  bytesReceived: 0,
  lastMessageTime: null,
  errors: 0,
  connectionTime: null,
  latencies: [],
};

/**
 * Initialize MQTT subscriber
 * @param {SocketIO.Server} socketIo - Socket.IO server instance for forwarding
 */
function initializeMQTTSubscriber(socketIo) {
  io = socketIo;
  
  console.log('🔌 [MQTT-Sub] Connecting to MQTT broker:', MQTT_BROKER_URL);
  
  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `backend_subscriber_${Date.now()}`,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30000,
  });

  mqttClient.on('connect', () => {
    stats.connected = true;
    stats.connectionTime = new Date();
    console.log('✅ [MQTT-Sub] Connected to MQTT broker');
    
    // Subscribe to all sensor topics
    mqttClient.subscribe(SUBSCRIBE_TOPIC, { qos: 1 }, (err, granted) => {
      if (err) {
        console.error('❌ [MQTT-Sub] Subscription error:', err);
        stats.errors++;
      } else {
        console.log('📡 [MQTT-Sub] Subscribed to:', granted[0].topic, 'with QoS', granted[0].qos);
      }
    });
  });

  mqttClient.on('message', async (topic, message, packet) => {
    const receiveTime = Date.now();
    
    try {
      // Parse topic: sensors/<channelId>/readings
      const topicParts = topic.split('/');
      if (topicParts.length !== 3 || topicParts[0] !== 'sensors' || topicParts[2] !== 'readings') {
        console.warn('⚠️  [MQTT-Sub] Invalid topic format:', topic);
        return;
      }

      const channelId = topicParts[1];
      const data = JSON.parse(message.toString());
      
      // Calculate latency if timestamp is provided
      let latency = 0;
      if (data.timestamp) {
        const sendTime = new Date(data.timestamp).getTime();
        latency = receiveTime - sendTime;
        stats.latencies.push(latency);
        // Keep only last 100 latencies
        if (stats.latencies.length > 100) {
          stats.latencies.shift();
        }
      }
      
      stats.messagesReceived++;
      stats.bytesReceived += message.length;
      stats.lastMessageTime = new Date();
      
      console.log(`📥 [MQTT-Sub] Received from ${topic}`);
      console.log(`   Channel: ${channelId}`);
      console.log(`   QoS: ${packet.qos}`);
      console.log(`   AQI: ${data.aqi || 'N/A'}`);
      console.log(`   Latency: ${latency}ms`);
      console.log(`   Size: ${message.length} bytes`);
      
      // Validate channel exists
      const channel = db.channels.findById(channelId);
      if (!channel) {
        console.warn('⚠️  [MQTT-Sub] Channel not found:', channelId);
        return;
      }

      // Store reading in database
      const reading = db.readings.create(channelId, {
        aqi: data.aqi,
        co2: data.co2,
        co: data.co || 0,
        no2: data.no2 || 0,
        temperature: data.temperature,
        humidity: data.humidity,
      });
      
      console.log('   ✅ Stored in database');

      // Forward to WebSocket clients
      if (io) {
        const roomName = `channel:${channelId}`;
        const clientsInRoom = io.sockets.adapter.rooms.get(roomName);
        if (clientsInRoom && clientsInRoom.size > 0) {
          io.to(roomName).emit('newReading', {
            channelId,
            reading,
            timestamp: new Date().toISOString(),
            serverTransmitTime: Date.now(), // For accurate latency calculation
            source: 'mqtt',
          });
          console.log(`   📤 Forwarded to ${clientsInRoom.size} WebSocket clients`);
        }
      }
      
    } catch (error) {
      console.error('❌ [MQTT-Sub] Error processing message:', error.message);
      stats.errors++;
    }
  });

  mqttClient.on('error', (error) => {
    console.error('❌ [MQTT-Sub] Connection error:', error.message);
    stats.connected = false;
    stats.errors++;
  });

  mqttClient.on('offline', () => {
    console.log('⚠️  [MQTT-Sub] Client offline, reconnecting...');
    stats.connected = false;
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 [MQTT-Sub] Reconnecting to MQTT broker...');
  });

  mqttClient.on('close', () => {
    console.log('🔌 [MQTT-Sub] Connection closed');
    stats.connected = false;
  });
}

/**
 * Get MQTT subscriber statistics
 */
function getSubscriberStats() {
  const avgLatency = stats.latencies.length > 0
    ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
    : 0;
  
  const minLatency = stats.latencies.length > 0
    ? Math.min(...stats.latencies)
    : 0;
  
  const maxLatency = stats.latencies.length > 0
    ? Math.max(...stats.latencies)
    : 0;

  return {
    ...stats,
    avgLatency: Math.round(avgLatency),
    minLatency,
    maxLatency,
    uptime: stats.connectionTime 
      ? Math.round((Date.now() - stats.connectionTime.getTime()) / 1000)
      : 0,
  };
}

/**
 * Publish a message to MQTT broker (for testing)
 */
function publishMessage(topic, message, options = {}) {
  if (!mqttClient || !stats.connected) {
    throw new Error('MQTT client not connected');
  }
  
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, payload, {
      qos: options.qos || 0,
      retain: options.retain || false,
    }, (err) => {
      if (err) {
        console.error('❌ [MQTT-Sub] Publish error:', err);
        reject(err);
      } else {
        console.log(`📤 [MQTT-Sub] Published to ${topic} (${payload.length} bytes)`);
        resolve();
      }
    });
  });
}

/**
 * Disconnect MQTT subscriber
 */
function disconnectSubscriber() {
  if (mqttClient) {
    console.log('🛑 [MQTT-Sub] Disconnecting...');
    mqttClient.end(false, () => {
      console.log('✅ [MQTT-Sub] Disconnected successfully');
    });
  }
}

module.exports = {
  initializeMQTTSubscriber,
  getSubscriberStats,
  publishMessage,
  disconnectSubscriber,
};
