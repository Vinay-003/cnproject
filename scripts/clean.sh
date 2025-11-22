#!/bin/bash

# Quick Clean Script - Stops all processes and cleans database

PROJECT_DIR="/home/mylappy/Desktop/cnproject/project"

echo "🧹 Cleaning up..."

# Kill all related processes
pkill -f "node.*server.js" 2>/dev/null && echo "✓ Backend stopped"
pkill -f "node.*nodemcu.js" 2>/dev/null && echo "✓ Simulator stopped"
pkill -f "expo start" 2>/dev/null && echo "✓ Expo stopped"
pkill -f "expo-cli" 2>/dev/null
pkill -f "Metro" 2>/dev/null

sleep 2

# Clean database
if [ -f "$PROJECT_DIR/backend/data.json" ]; then
    rm "$PROJECT_DIR/backend/data.json"
    echo "✓ Database cleared"
fi

# Clean .env.simulator
if [ -f "$PROJECT_DIR/.env.simulator" ]; then
    rm "$PROJECT_DIR/.env.simulator"
    echo "✓ Simulator config cleared"
fi

echo ""
echo "✅ All cleaned up!"
echo "Run: ./scripts/fresh-start.sh to start fresh"
