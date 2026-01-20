# 🐳 Docker Setup Guide - PentiumPOS

## Overview

This project has **TWO** Docker environments:

| Environment        | File                                        | Purpose                           | Resource Limits            |
| ------------------ | ------------------------------------------- | --------------------------------- | -------------------------- |
| **Development**    | `docker-compose.yml`                        | Daily development with hot-reload | ❌ None (use full machine) |
| **Production Sim** | `backend/docker-compose.production-sim.yml` | Debug production issues           | ✅ 1 vCPU, 1.5GB RAM (VPS) |

---

## Prerequisites

✅ **Docker Desktop**: Version 29.1.3+ installed and running  
✅ **Docker Compose**: Version 5.0.0+ (included with Docker Desktop)  
✅ **Ports Available**: 3001 (backend), 3306 (MySQL), 5173 (frontend), 6379 (Redis)

---

## Quick Start - Development Environment

### 1. Create Environment File

```bash
# Copy the example file
cp .env.example .env

# Edit .env and set your passwords
# At minimum, change:
# - MYSQL_ROOT_PASSWORD
# - MYSQL_PASSWORD
# - JWT_SECRET (must be 32+ chars)
```

### 2. Start All Services

```bash
# Start everything (MySQL + Redis + Backend + Frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend
```

### 3. Verify Services

```bash
# Check all containers are running
docker-compose ps

# Expected output:
# pentiumpos-db-dev        ✅ healthy
# pentiumpos-redis-dev     ✅ healthy
# pentiumpos-backend-dev   ✅ running
# pentiumpos-frontend-dev  ✅ running
```

### 4. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api/v1
- **Health Check**: http://localhost:3001/health

### 5. Run Migrations

```bash
# Migrations run automatically, but to run manually:
docker-compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker-compose exec backend npx prisma generate

# Seed database (if you have a seed script)
docker-compose exec backend npx prisma db seed
```

---

## Development Workflow

### Hot Reload

Both **frontend** and **backend** have hot-reload enabled via volume mounts:

```yaml
# Changes to these files trigger auto-reload:
./backend/src/**/*.ts      →  Backend reloads
./frontend/src/**/*.tsx    →  Frontend HMR
./backend/prisma/*.prisma  →  Run: docker-compose exec backend npx prisma generate
```

### Common Commands

```bash
# Restart a single service
docker-compose restart backend

# Rebuild after dependency changes
docker-compose up -d --build backend

# View database logs
docker-compose logs -f db

# Execute commands in backend container
docker-compose exec backend npm test
docker-compose exec backend npm run lint

# Access MySQL CLI
docker-compose exec db mysql -u root -p pentiumpos

# Access Redis CLI
docker-compose exec redis redis-cli
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ DELETES DATABASE DATA)
docker-compose down -v
```

---

## Production Simulation Environment

### When to Use

Use this to reproduce production issues:

- Connection pool exhaustion
- CPU saturation under load
- Memory pressure
- Slow queries on limited hardware

### Start Production Sim

```bash
cd backend
docker-compose -f docker-compose.production-sim.yml up -d
```

### Verify Resource Limits

```bash
# Check CPU/Memory limits are enforced
docker stats gastro-mysql-sim gastro-app-sim gastro-redis-sim

# Expected:
# gastro-mysql-sim:  CPU ~100% (1 core max), MEM ~1.5GB max
# gastro-app-sim:    CPU ~100% (1 core max), MEM ~1GB max
# gastro-redis-sim:  CPU ~50% (0.5 core max), MEM ~256MB max
```

### Run Load Tests

```bash
# Inside backend container
docker-compose -f docker-compose.production-sim.yml exec app-production-sim npx ts-node scripts/extreme-load-test-fast.ts

# Monitor connection pool
docker exec -it gastro-mysql-sim mysql -u root -proot_password_production_sim -e "SHOW STATUS LIKE 'Threads_connected';"
```

See `backend/README_SIMULATION.md` for detailed simulation guide.

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3306
netstat -ano | findstr :3306

# Kill the process or change port in docker-compose.yml:
ports:
  - "3307:3306"  # Use 3307 on host instead
```

### Container Crashes Immediately

```bash
# View crash logs
docker-compose logs backend

# Common issues:
# 1. Database not ready → Wait for db health check
# 2. Missing .env → Copy .env.example to .env
# 3. Port conflict → Change ports in docker-compose.yml
```

### "Cannot connect to MySQL"

```bash
# Ensure database is healthy
docker-compose ps db

# If unhealthy, check logs
docker-compose logs db

# Reset database (⚠️ DELETES DATA)
docker-compose down -v
docker-compose up -d
```

### Prisma Client Out of Sync

```bash
# Regenerate Prisma client
docker-compose exec backend npx prisma generate

# Restart backend
docker-compose restart backend
```

### Hot Reload Not Working

```bash
# 1. Ensure volumes are mounted correctly
docker-compose config | grep volumes

# 2. Rebuild containers
docker-compose up -d --build

# 3. Check file permissions (Windows/WSL issue)
# Run VS Code/terminal as administrator
```

### Out of Disk Space (Windows)

```bash
# Clean up Docker
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Check Docker Desktop settings
# Settings → Resources → Disk image size
```

---

## Networking

All services communicate via **internal Docker network**:

```
pentiumpos-dev-network (development)
production-sim-network (simulation)
```

Internal DNS resolves:

- `db` → MySQL container
- `redis` → Redis container
- `backend` → Backend container
- `frontend` → Frontend container

---

## Database Access from Host

### MySQL Workbench / DBeaver

```
Host: localhost
Port: 3306
User: pentium_user (or root)
Password: [from .env]
Database: pentiumpos
```

### CLI Access

```bash
# From host (requires mysql client)
mysql -h 127.0.0.1 -P 3306 -u root -p

# From inside container
docker-compose exec db mysql -u root -p pentiumpos
```

---

## Environment Variables Reference

| Variable       | Development           | Production Sim         | Description              |
| -------------- | --------------------- | ---------------------- | ------------------------ |
| `DATABASE_URL` | 200 connection limit  | 100 connection limit   | Prisma connection string |
| `REDIS_HOST`   | `redis`               | `redis-production-sim` | Redis hostname           |
| `NODE_ENV`     | `development`         | `production`           | Application environment  |
| `LOG_LEVEL`    | `debug`               | `info`                 | Logging verbosity        |
| `CORS_ORIGINS` | `localhost:5173,3000` | Same                   | Allowed CORS origins     |

---

## CI/CD Integration

```yaml
# Example GitHub Actions
- name: Start Docker services
  run: docker-compose up -d

- name: Wait for services
  run: docker-compose exec -T backend npx wait-on http://localhost:3001/health

- name: Run tests
  run: docker-compose exec -T backend npm test

- name: Cleanup
  run: docker-compose down -v
```

---

## Performance Tuning

### Increase Docker Resources

**Windows/Mac**: Docker Desktop → Settings → Resources

- CPUs: 4-8 cores
- Memory: 8-16 GB
- Swap: 2 GB
- Disk: 60+ GB

### Optimize MySQL

Edit `backend/mysql-config/my.cnf` (production sim only)

### Optimize Application

```env
# .env
DATABASE_URL=mysql://...?connection_limit=200&pool_timeout=20&connect_timeout=10
```

---

## Useful Links

- **Docker Docs**: https://docs.docker.com
- **Compose Spec**: https://docs.docker.com/compose/compose-file/
- **Production Sim Guide**: `backend/README_SIMULATION.md`
- **Load Test Results**: `backend/EXTREME_LOAD_TEST_RESULTS.md`

---

## Support

Issues? Check:

1. ✅ Docker Desktop is running
2. ✅ `.env` file exists with correct values
3. ✅ Ports 3001, 3306, 5173, 6379 are free
4. ✅ `docker-compose ps` shows all services healthy
5. ✅ `docker-compose logs` for error messages

Still stuck? Open an issue or contact DevOps team.
