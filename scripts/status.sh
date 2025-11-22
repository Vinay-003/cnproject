#!/bin/bash

# Quick Start Helper - Shows what's running and how to start

echo "🔍 IoT Air Quality System - Status Check"
echo "========================================="
echo ""

# Check backend
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Backend Server: RUNNING on port 3000"
else
    echo "❌ Backend Server: NOT RUNNING"
    echo "   Start with: node backend/server.js"
fi

# Check simulator
if pgrep -f "node.*nodemcu.js" > /dev/null; then
    echo "✅ NodeMCU Simulator: RUNNING"
else
    echo "❌ NodeMCU Simulator: NOT RUNNING"
    echo "   Start with: CHANNEL_ID=xxx WRITE_API_KEY=xxx node simulator/nodemcu.js"
fi

# Check Expo
if pgrep -f "expo start" > /dev/null; then
    echo "✅ Mobile App: RUNNING"
else
    echo "❌ Mobile App: NOT RUNNING"
    echo "   Start with: npm start"
fi

echo ""
echo "========================================="
echo "Quick Commands:"
echo "  ./scripts/fresh-start.sh  - Complete fresh start"
echo "  ./scripts/clean.sh        - Stop all & clean"
echo "  ./scripts/status.sh       - Check what's running"
echo "========================================="
