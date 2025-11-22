#!/bin/bash
# Start both MQTT broker and HTTP/WebSocket server

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   IoT Air Quality Monitoring System - Full Stack Startup      ║"
echo "║   Starting MQTT Broker + HTTP/WebSocket Server                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Start MQTT broker in background
echo "🚀 Starting MQTT Broker..."
node backend/mqtt-broker.js > logs/mqtt-broker.log 2>&1 &
MQTT_PID=$!
echo "   MQTT Broker PID: $MQTT_PID"
echo ""

# Wait for MQTT broker to start
sleep 2

# Start main server (includes MQTT subscriber and WebSocket)
echo "🚀 Starting Main Server (HTTP + WebSocket + MQTT Subscriber)..."
node backend/server.js

# Cleanup on exit
trap "echo ''; echo '🛑 Stopping services...'; kill $MQTT_PID 2>/dev/null; exit" INT TERM
