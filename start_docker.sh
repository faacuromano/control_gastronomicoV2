#!/bin/bash

echo "========================================================"
echo "  PentiumPOS Docker Launcher"
echo "========================================================"
echo ""

# 1. Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker is NOT running or not installed."
    echo "Please start Docker and try again."
    exit 1
fi

# 2. Check/Create .env file
if [ ! -f .env ]; then
    echo "[INFO] .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "[OK] .env created."
else
    echo "[OK] .env file found."
fi

# 3. Start Docker Compose
echo ""
echo "[INFO] Starting containers... (This may take a while on first run)"
echo ""
docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to start containers."
    exit 1
fi

# 4. Show Status
echo ""
echo "[OK] System started successfully!"
echo "--------------------------------------------------------"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo "Database: localhost:3307"
echo "--------------------------------------------------------"
echo ""

# Open browser (cross-platform attempt)
if which xdg-open > /dev/null; then
  xdg-open http://localhost:5173
elif which open > /dev/null; then
  open http://localhost:5173
fi
