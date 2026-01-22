# ==============================================================================
# 🛠️ CHAOS FIXER - FORCE PROXY CONFIGURATION
# ==============================================================================

$Headers = @{ "Content-Type" = "application/json" }
$ProxyUrl = "http://127.0.0.1:8474/proxies"

# Wait for Toxiproxy API to be available
$maxRetries = 20
$retryCount = 0
$healthy = $false

Write-Host "⏳ Waiting for Toxiproxy API to be ready..." -NoNewline

while ($retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8474/version" -Method Get -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $healthy = $true
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

if (-not $healthy) {
    Write-Host "`n❌ Error: Toxiproxy API failed to respond after 20 seconds." -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Checking current proxies..."
try {
    $current = Invoke-RestMethod -Uri $ProxyUrl -Method Get
    Write-Host "Current Config: $($current | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Failed to retrieve current proxies from Toxiproxy API." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 1. CREATE PROXY
Write-Host "`n1️⃣ Creating Proxy 'app_slow'..."
$proxyBody = @{
    name     = "app_slow"
    listen   = "0.0.0.0:3001"
    upstream = "benchmark_app:3000"  # Use container name explicitly if 'app' fails
    enabled  = $true
} | ConvertTo-Json

try {
    # Try deleting it first just in case
    try { Invoke-RestMethod -Uri "$ProxyUrl/app_slow" -Method Delete -ErrorAction SilentlyContinue } catch {}

    $response = Invoke-RestMethod -Uri $ProxyUrl -Method Post -Body $proxyBody -Headers $Headers
    Write-Host "✅ Proxy Created!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json) -ForegroundColor Gray
}
catch {
    Write-Host "❌ FAILED to create proxy!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "API Response: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    exit 1
}

# 2. ADD TOXIC (LATENCY)
Write-Host "`n2️⃣ Injecting Latency (50ms)..."
$toxicUrl = "$ProxyUrl/app_slow/toxics"
$toxicBody = @{
    type       = "latency"
    attributes = @{
        latency = 50
        jitter  = 20
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $toxicUrl -Method Post -Body $toxicBody -Headers $Headers
    Write-Host "✅ Latency Injected!" -ForegroundColor Green
}
catch {
    Write-Host "❌ FAILED to inject toxic!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "`n🎉 CHAOS IS READY. Now run 'npx ts-node scripts/http-stress-test.ts'" -ForegroundColor Cyan
