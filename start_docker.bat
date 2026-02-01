@echo off
setlocal
title PentiumPOS - Starting with Docker...

echo ========================================================
echo   PentiumPOS Docker Launcher
echo ========================================================
echo.

:: 1. Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is NOT running or not installed.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

:: 2. Check/Create .env file
if not exist .env (
    echo [INFO] .env file not found. Creating from .env.example...
    copy .env.example .env >nul
    echo [OK] .env created.
) else (
    echo [OK] .env file found.
)

:: 3. Start Docker Compose
echo.
echo [INFO] Starting containers... (This may take a while on first run)
echo.
docker-compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start containers. See output above.
    pause
    exit /b 1
)

:: 4. Show Status
echo.
echo [OK] System started successfully!
echo --------------------------------------------------------
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo Database: localhost:3307
echo --------------------------------------------------------
echo.
echo Press any key to open the application...
pause >nul
start http://localhost:5173

endlocal
