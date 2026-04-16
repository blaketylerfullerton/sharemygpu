#!/usr/bin/env bash
set -e

echo "Starting GPU Co-op in development mode..."

# Kill any existing processes on our ports
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build the daemon TypeScript for dev usage with ts-node
npm run dev
