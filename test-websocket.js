#!/usr/bin/env node
/**
 * WebSocket Test Client
 * Tests real-time communication between backend and client
 */

const io = require('socket.io-client');

const API_URL = 'http://192.168.1.12:3000';
const TEST_CHANNEL_ID = 'test_channel_123';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║   WebSocket Test Client                                ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log(`🔌 Connecting to: ${API_URL}\n`);

const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

let messagesReceived = 0;
let totalBytes = 0;
const latencies = [];

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log(`   Socket ID: ${socket.id}\n`);
  
  // Join a test channel
  console.log(`📡 Joining channel: ${TEST_CHANNEL_ID}`);
  socket.emit('join-channel', TEST_CHANNEL_ID);
});

socket.on('joined', (data) => {
  console.log('✅ Successfully joined channel:', data.channelId);
  console.log('   Timestamp:', data.timestamp, '\n');
  console.log('🎧 Listening for newReading events...\n');
});

socket.on('newReading', (data) => {
  const receiveTime = Date.now();
  const serverTime = new Date(data.timestamp).getTime();
  const latency = receiveTime - serverTime;
  
  messagesReceived++;
  const messageSize = JSON.stringify(data).length;
  totalBytes += messageSize;
  latencies.push(latency);
  
  console.log(`📥 Message #${messagesReceived} received`);
  console.log(`   Channel: ${data.channelId}`);
  console.log(`   AQI: ${data.reading.aqi}`);
  console.log(`   CO₂: ${data.reading.co2} ppm`);
  console.log(`   CO: ${data.reading.co} ppm`);
  console.log(`   NO₂: ${data.reading.no2} ppm`);
  console.log(`   Temp: ${data.reading.temperature}°C`);
  console.log(`   Humidity: ${data.reading.humidity}%`);
  console.log(`   ⏱️  Latency: ${latency}ms`);
  console.log(`   📦 Size: ${messageSize} bytes`);
  console.log('');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from WebSocket server');
  console.log('   Reason:', reason, '\n');
  
  // Print statistics
  if (messagesReceived > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const avgMessageSize = totalBytes / messagesReceived;
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Session Statistics                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Messages Received: ${messagesReceived}`);
    console.log(`📦 Total Data: ${(totalBytes / 1024).toFixed(2)} KB`);
    console.log(`📏 Avg Message Size: ${avgMessageSize.toFixed(0)} bytes`);
    console.log(`⏱️  Latency Stats:`);
    console.log(`   - Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`   - Min: ${minLatency}ms`);
    console.log(`   - Max: ${maxLatency}ms`);
    console.log('');
  }
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection Error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  socket.disconnect();
  process.exit(0);
});

console.log('💡 Tip: Start a simulator to see real-time messages');
console.log('   Press Ctrl+C to exit\n');
