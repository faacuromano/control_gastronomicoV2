# ==============================================================================
# 🏎️ BENCHMARK SCRIPT (WINDOWS / POWERSHELL)
# ==============================================================================

Write-Host "🔥 INITIATING DIGITAL TWIN ENVIRONMENT (Hostinger KVM2 Specs)..." -ForegroundColor Cyan

# 1. PRE-FLIGHT CHECK: IS DOCKER RUNNING?
Write-Host "🔍 Checking Docker connectivity..."
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not found or not running" }
    Write-Host "✅ Docker Engine is ONLINE." -ForegroundColor Green
}
catch {
    Write-Host "`n❌ FATAL ERROR: DOCKER IS NOT RUNNING!" -ForegroundColor Red -BackgroundColor Black
    Write-Host "--------------------------------------------------------"
    Write-Host "The script cannot talk to the Docker Daemon (Engine)."
    Write-Host "1. Press the Windows Key and type 'Docker Desktop'."
    Write-Host "2. Launch the application and wait 1-2 minutes."
    Write-Host "3. Look for the whale icon in your system tray."
    Write-Host "4. Try again when it says 'Docker Desktop is running'."
    Write-Host "--------------------------------------------------------"
    exit 1
}

# 2. CLEANUP & BUILD
Write-Host "🧹 Cleaning previous containers..."
docker-compose -f docker-compose.benchmark.yml down -v
Write-Host "🏗️ Building optimized container..."
docker-compose -f docker-compose.benchmark.yml build

# 3. START INFRASTRUCTURE
Write-Host "🚀 Starting Stack (App + DB + Redis + ChaosProxy)..."
docker-compose -f docker-compose.benchmark.yml up -d

Write-Host "⏳ Waiting 20s for Database cold start..."
Start-Sleep -Seconds 20

# Wait for Toxiproxy API to be available
$maxRetries = 20
$retryCount = 0
$chaosReady = $false

Write-Host "🔌 Waiting for Toxiproxy API to be ready..." -NoNewline
while ($retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8474/version" -Method Get -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $chaosReady = $true
            Write-Host " ✅ OK!"
            break
        }
    }
    catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $retryCount++
    }
}

if (-not $chaosReady) {
    Write-Host "`n⚠️ Warning: Toxiproxy API not reachable. Chaos injection might fail."
}

# 4. CONFIGURE CHAOS (Network Degradation)
Write-Host "🌩️ INJECTING NETWORK CHAOS (50ms latency, 20ms jitter)..." -ForegroundColor Yellow

# Create Proxy
$headers = @{ "Content-Type" = "application/json" }
$proxyBody = @{
    name     = "app_slow"
    listen   = "0.0.0.0:3001"
    upstream = "app:3000"
    enabled  = $true
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:8474/proxies" -Method Post -Body $proxyBody -Headers $headers
}
catch {
    Write-Host "⚠️ Warning: Proxy config failed (maybe already exists?)" -ForegroundColor Red
}

# Add Toxic
$toxicBody = @{
    type       = "latency"
    attributes = @{
        latency = 80
        jitter  = 20
    }
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:8474/proxies/app_slow/toxics" -Method Post -Body $toxicBody -Headers $headers
}
catch {
    Write-Host "⚠️ Warning: Toxic injection failed" -ForegroundColor Red
}

Write-Host "`n✅ NETWORK DEGRADED. CONNECT TO PORT 3001 for REALISTIC TESTING." -ForegroundColor Green

# 5. INSTRUCTIONS
Write-Host "`n💥 READY TO EXECUTE LOAD TEST" -ForegroundColor Cyan
Write-Host "Please execute your load test (k6 or script) pointing to: http://localhost:3001"
Write-Host "Monitor Docker stats in another terminal: docker stats"
