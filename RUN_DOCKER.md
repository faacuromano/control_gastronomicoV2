# How to Run PentiumPOS

This project is containerized with Docker for easy execution.

## Prerequisites

1.  **Install Docker Desktop**:
    - Download and install from [docker.com](https://www.docker.com/products/docker-desktop).
    - Start Docker Desktop and ensure it is running in the background.

## Quick Start (Easiest)

### Windows

Double-click the `start_docker.bat` file in this folder.

### Mac / Linux

Open a terminal and run:

```bash
chmod +x start_docker.sh
./start_docker.sh
```

## Manual Start

If you prefer running commands manually:

1.  **Create Environment File**:
    Copy the example configuration to a real `.env` file:

    ```bash
    cp .env.example .env
    ```

2.  **Start Services**:
    ```bash
    docker-compose up -d
    ```

## Accessing the App

- **Frontend (POS)**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Database**: localhost:3307

## Troubleshooting

- **"Docker is not running"**: Ensure the Docker Desktop whale icon is visible in your taskbar.
- **Port Conflicts**: If the script fails, ensure ports 3001, 5173, and 3307 are not used by other applications.
