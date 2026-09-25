# Script dang ky Debezium Connector cho Project & Task Service
# Chay tu thu muc goc cua repo: powershell -ExecutionPolicy Bypass -File .\scripts\register-debezium.ps1

$debeziumUrl = "http://localhost:8083"
$connectorName = "pt-outbox-connector"
$configFile = Join-Path $PSScriptRoot "..\infra\debezium\register-pt-connector.json"

Write-Host "Kiem tra ket noi Debezium Connect tai $debeziumUrl..." -ForegroundColor Cyan

# Cho Debezium san sang
$maxRetries = 20
$retry = 0
$ready = $false

while (-not $ready -and $retry -lt $maxRetries) {
    try {
        $null = Invoke-RestMethod -Uri "$debeziumUrl/connectors" -Method Get -TimeoutSec 3 -ErrorAction Stop
        $ready = $true
    } catch {
        $retry++
        Write-Host "Debezium dang khoi dong, cho tiep ($retry/$maxRetries)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if (-not $ready) {
    Write-Error "Debezium Connect khong phan hoi tren cong 8083. Hay dam bao container 'debezium' dang chay!"
    exit 1
}

# Kiem tra xem connector da duoc dang ky chua
$existing = Invoke-RestMethod -Uri "$debeziumUrl/connectors" -Method Get
$configJson = Get-Content $configFile -Raw | ConvertFrom-Json

if ($existing -contains $connectorName) {
    Write-Host "Connector '$connectorName' da ton tai. Dang cap nhat cau hinh moi..." -ForegroundColor Yellow
    $configPayload = $configJson.config | ConvertTo-Json -Depth 10
    $res = Invoke-RestMethod -Uri "$debeziumUrl/connectors/$connectorName/config" -Method Put -Body $configPayload -ContentType "application/json"
} else {
    Write-Host "Dang tao moi connector '$connectorName'..." -ForegroundColor Green
    $body = Get-Content $configFile -Raw
    $res = Invoke-RestMethod -Uri "$debeziumUrl/connectors" -Method Post -Body $body -ContentType "application/json"
}

Start-Sleep -Seconds 2

# Kiem tra trang thai task
try {
    $status = Invoke-RestMethod -Uri "$debeziumUrl/connectors/$connectorName/status" -Method Get
    Write-Host "`n=== Trang thai Connector ===" -ForegroundColor Green
    Write-Host "Connector State: $($status.connector.state)"
    foreach ($task in $status.tasks) {
        Write-Host "Task #$($task.id) State: $($task.state)"
        if ($task.trace) {
            Write-Host "Error trace: $($task.trace)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "Chua doc duoc status ngay: $_" -ForegroundColor Yellow
}
