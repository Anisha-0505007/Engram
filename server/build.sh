#!/usr/bin/env bash
set -e   # exit immediately on any error

echo "==> Installing server dependencies..."
npm install

echo "==> Installing client dependencies..."
cd ../client
npm install

echo "==> Building React client..."
npm run build

echo "==> Build complete. React app is in server/public/"
