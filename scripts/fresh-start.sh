#!/bin/bash

# IoT Air Quality Monitoring System - Fresh Start Script
# This script helps you start the entire system from scratch

set -e

PROJECT_DIR="/home/mylappy/Desktop/cnproject/project"
cd "$PROJECT_DIR"

echo "🚀 IoT Air Quality Monitoring System - Fresh Start"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored text
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Step 1: Clean up old processes
echo "Step 1: Cleaning up old processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*nodemcu.js" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "expo-cli" 2>/dev/null || true
sleep 2
print_status "Old processes stopped"
echo ""

# Step 2: Clean database
echo "Step 2: Cleaning database..."
if [ -f "backend/data.json" ]; then
    rm backend/data.json
    print_status "Database cleared"
else
    print_info "No existing database found"
fi
echo ""

# Step 3: Check Node.js installation
echo "Step 3: Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found! Please install Node.js first."
    exit 1
fi
echo ""

# Step 4: Get IP address
echo "Step 4: Getting your IP address..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')
if [ -z "$IP_ADDRESS" ]; then
    print_warning "Could not detect IP address automatically"
    read -p "Enter your IP address manually: " IP_ADDRESS
fi
print_status "Your IP address: $IP_ADDRESS"

# Update .env file
echo "EXPO_PUBLIC_API_BASE=http://$IP_ADDRESS:3000" > .env
print_status ".env file updated"
echo ""

# Step 5: Install dependencies (if needed)
echo "Step 5: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies (this may take a few minutes)..."
    npm install
    print_status "Dependencies installed"
else
    print_status "Dependencies already installed"
fi
echo ""

# Step 6: Instructions
echo "=================================================="
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  Start Backend Server (in a NEW terminal):"
echo -e "${BLUE}   cd $PROJECT_DIR${NC}"
echo -e "${BLUE}   node backend/server.js${NC}"
echo ""
echo "2️⃣  Start Mobile App (in ANOTHER NEW terminal):"
echo -e "${BLUE}   cd $PROJECT_DIR${NC}"
echo -e "${BLUE}   npm start${NC}"
echo ""
echo "3️⃣  On your phone:"
echo "   - Open Expo Go app"
echo "   - Scan the QR code"
echo "   - Register a new account"
echo "   - Create a channel (SAVE the API keys!)"
echo ""
echo "4️⃣  Start NodeMCU Simulator (in ANOTHER NEW terminal):"
echo -e "${BLUE}   cd $PROJECT_DIR${NC}"
echo -e "${BLUE}   CHANNEL_ID=your_channel_id WRITE_API_KEY=your_write_key \\${NC}"
echo -e "${BLUE}   SERVER_URL=http://$IP_ADDRESS:3000 node simulator/nodemcu.js${NC}"
echo ""
echo "=================================================="
echo "📖 For detailed instructions, see: FRESH_START.md"
echo "=================================================="
echo ""

# Ask if user wants to start backend now
read -p "Do you want to start the backend server now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    print_info "Starting backend server..."
    print_warning "Keep this terminal open!"
    echo ""
    node backend/server.js
fi
