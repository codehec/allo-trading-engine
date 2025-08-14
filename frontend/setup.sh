#!/bin/bash

echo "🚀 Setting up Allo Trading Engine Frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully!"

# Start development server
echo "🌐 Starting development server..."
echo "📱 Open your browser and navigate to: http://localhost:3000"
echo "🔗 Make sure to connect your MetaMask wallet to BSC Testnet"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
