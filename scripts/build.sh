#!/usr/bin/env bash
set -e

echo "Building GPU Co-op..."

npm run build:vite
npm run build:ts

echo "Build complete. Run 'npm run build:mac|win|linux' to package."
