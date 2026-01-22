
# ROBOTIC PRECISION - BENCHMARK SETUP
$ErrorActionPreference = "Stop"

Write-Host "🔥 INITIATING ROBUST ENVIRONMENT SETUP..." -ForegroundColor Cyan

# 1. CLEANUP
Write-Host "🧹 Cleaning up..."
docker-compose -f docker-compose.benchmark.yml down -v --remove-orphans 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "⚠️ Cleanup warning (ignored)" -ForegroundColor Gray }

# 2. STARTUP
Write-Host "🚀 Starting Containers..."
docker-compose -f docker-compose.benchmark.yml up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Docker Compose Failed!"; exit 1 }

# 3. VERIFY TOXIPROXY
Write-Host "🔌 Waiting for Toxiproxy API (Port 8474)..." -NoNewline
$max = 30
$url = "http://127.0.0.1:8474/version"
$ready = $false

for ($i = 0; $i -lt $max; $i++) {
    # Use CURL.EXE specifically to bypass PowerShell web stack issues
    $out = curl.exe -s --connect-timeout 1 $url
    if ($LASTEXITCODE -eq 0 -and $out -match "\d+\.\d+\.\d+") {
        $ready = $true
        Write-Host " ✅ OK!" -ForegroundColor Green
        break
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Host "`n❌ FATAL: Toxiproxy API not reachable at $url" -ForegroundColor Red
    docker logs benchmark_chaos
    exit 1
}

# 4. CONFIGURE PROXY
Write-Host "⚙️  Configuring Proxy (3001 -> 3000)..." -NoNewline
$proxyConfig = '{"name": "benchmark_proxy", "listen": "0.0.0.0:3001", "upstream": "benchmark_app:3000", "enabled": true}'
$out = curl.exe -s -X POST -H "Content-Type: application/json" -d $proxyConfig http://127.0.0.1:8474/proxies

if ($out -match "benchmark_proxy") {
    Write-Host " ✅ OK!" -ForegroundColor Green
}
elseif ($out -match "already exists") {
    Write-Host " ⚠️ Exists" -ForegroundColor Yellow
}
else {
    Write-Host "`n❌ Config Failed: $out" -ForegroundColor Red
    exit 1
}

# 5. INJECT CHAOS
Write-Host "🌩️  Injecting Latency (50ms)..." -NoNewline
$toxicConfig = '{"type": "latency", "attributes": {"latency": 50, "jitter": 20}}'
$out = curl.exe -s -X POST -H "Content-Type: application/json" -d $toxicConfig http://127.0.0.1:8474/proxies/benchmark_proxy/toxics

if ($out -match "latency") {
    Write-Host " ✅ OK!" -ForegroundColor Green
}
elseif ($out -match "already exists") {
    Write-Host " ⚠️ Exists" -ForegroundColor Yellow
}
else {
    Write-Host "`n❌ Toxic Failed: $out" -ForegroundColor Red
    exit 1
}

# 6. WAIT FOR DATABASE
Write-Host "⏳ Waiting for Database (15s)..."
Start-Sleep -Seconds 15

# 7. SEED DB
Write-Host "🌱 Seeding Database..."
docker exec benchmark_app npx prisma db push --accept-data-loss
docker exec benchmark_app npx prisma db seed

Write-Host "`n✅ ENVIRONMENT READY. RUN TEST NOW:" -ForegroundColor Green
Write-Host "npx ts-node --transpile-only scripts/http-stress-test.ts" -ForegroundColor Cyan
