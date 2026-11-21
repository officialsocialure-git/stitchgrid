$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$backendPath = Join-Path $PSScriptRoot 'backend'
$mobilePath = Join-Path $PSScriptRoot 'mobile-app'
$envPath = Join-Path $backendPath '.env'

Write-Host ''
Write-Host '=== STITCHGRID Expo Go test setup ===' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $envPath)) { throw 'backend\.env is missing. Restore your existing local backend environment file.' }
if (-not (Test-Path (Join-Path $backendPath 'node_modules'))) { throw 'Backend dependencies are missing. Run npm ci inside backend first.' }
if (-not (Test-Path (Join-Path $mobilePath 'node_modules'))) { throw 'Mobile dependencies are missing. Run npm ci inside mobile-app first.' }

Write-Host '[1/3] Enabling MOCK_TEST payments in backend\.env (local machine only)...'
$envText = [System.IO.File]::ReadAllText($envPath)
if ($envText -match '(?m)^MOCK_PAYMENTS_ENABLED=.*$') {
  $envText = [regex]::Replace($envText, '(?m)^MOCK_PAYMENTS_ENABLED=.*$', 'MOCK_PAYMENTS_ENABLED=true')
} else {
  $envText = $envText.TrimEnd() + [Environment]::NewLine + 'MOCK_PAYMENTS_ENABLED=true' + [Environment]::NewLine
}
[System.IO.File]::WriteAllText($envPath, $envText, [System.Text.UTF8Encoding]::new($false))

Write-Host '[2/3] Detecting the active Wi-Fi/Ethernet IPv4 address...'
$network = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
$lanIp = $network.IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanIp) { throw 'Could not detect a LAN IPv4 address. Connect this PC to Wi-Fi/Ethernet and try again.' }
$apiUrl = "http://${lanIp}:5000/api"
Write-Host "Phone API URL: $apiUrl" -ForegroundColor Green

$portInUse = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) { throw 'Port 5000 is already in use. Stop the existing backend terminal and run this launcher again.' }

Write-Host '[3/3] Starting local API and Expo Metro...'
$backendCommand = 'cd /d "' + $backendPath + '" && set NODE_ENV=development && set PORT=5000 && npm run dev'
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $backendCommand) -WorkingDirectory $backendPath

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $health = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2 -UseBasicParsing
    if ($health.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if (-not $ready) {
  Write-Warning 'The local API did not respond within 60 seconds. Check the STITCHGRID LOCAL API terminal before testing app screens.'
}

$mobileCommand = 'cd /d "' + $mobilePath + '" && set EXPO_PUBLIC_API_URL=' + $apiUrl + ' && npx expo start --lan -c'
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', $mobileCommand) -WorkingDirectory $mobilePath

Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '1. Wait for the API terminal to show that it is listening on port 5000.'
Write-Host '2. Wait for Expo to display its QR code.'
Write-Host '3. Keep your phone and PC on the same Wi-Fi network.'
Write-Host '4. Open Expo Go and scan the QR code.'
Write-Host '5. If Windows Firewall asks, allow Node.js on Private networks.'
Write-Host ''
Write-Host 'Local MOCK_TEST mode is ON. Razorpay checkout and supplier payouts remain disabled.' -ForegroundColor Yellow
Write-Host 'This launcher does not run migrations, reset the database, or delete test data.' -ForegroundColor Green