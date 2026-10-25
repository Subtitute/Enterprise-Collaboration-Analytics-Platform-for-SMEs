# 25/10/2026: ham/hang so dung chung cho scripts/cdc-on.ps1 va scripts/cdc-off.ps1 (CDC Debezium,
# profile `cdc` trong infra/docker-compose.yml). Khong chay truc tiep file nay.
$ErrorActionPreference = 'Stop'
# PowerShell 5.1 mac dinh gui "Expect: 100-continue" voi PUT co body - tat cho gon request.
[System.Net.ServicePointManager]::Expect100Continue = $false

$ComposeFile = Join-Path $PSScriptRoot '..\infra\docker-compose.yml'
$ConnectorFile = Join-Path $PSScriptRoot '..\infra\debezium\register-pt-connector.json'
$ConnectUrl = 'http://127.0.0.1:8083'
$Connector = 'pt-outbox-connector'
# Trung voi slot.name / publication.name trong register-pt-connector.json.
$Slot = 'pt_outbox_slot'
$Publication = 'pt_outbox_pub'

function Invoke-Compose {
    & docker compose -f $ComposeFile @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose $args that bai (exit $LASTEXITCODE)" }
}

# Chay SQL tren postgres-pt qua socket noi bo cua container (khong can mat khau tren host).
function Invoke-PtSql([string]$Sql) {
    $out = $Sql | docker exec -i postgres-pt sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -tAq -v ON_ERROR_STOP=1'
    if ($LASTEXITCODE -ne 0) { throw "SQL that bai: $Sql" }
    return ($out | Out-String).Trim()
}

function Wait-Until([scriptblock]$Condition, [string]$What, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try { if (& $Condition) { return $true } } catch { }
        Start-Sleep -Seconds 2
    }
    Write-Host "Het $TimeoutSec giay cho: $What" -ForegroundColor Yellow
    return $false
}

function Get-ConnectorStatus {
    try { return Invoke-RestMethod "$ConnectUrl/connectors/$Connector/status" -TimeoutSec 5 } catch { return $null }
}

function Test-ConnectorRunning {
    $s = Get-ConnectorStatus
    return [bool]($s -and $s.connector.state -eq 'RUNNING' -and @($s.tasks).Count -gt 0 -and @($s.tasks)[0].state -eq 'RUNNING')
}

# 25/10/2026 (fix ra soat CDC): REST bao RUNNING chua du (vd sau `docker compose down` thuong,
# debezium khong thuoc profile mac dinh nen van chay) - slot phai dang active moi chac CDC doc WAL.
function Test-SlotActive {
    return ((Invoke-PtSql "SELECT count(*) FROM pg_replication_slots WHERE slot_name = '$Slot' AND active") -eq '1')
}

# 25/10/2026 (fix ra soat CDC): slot vuot max_slot_wal_keep_size thi wal_status='lost', khong dung lai duoc.
function Test-SlotLost {
    return ((Invoke-PtSql "SELECT count(*) FROM pg_replication_slots WHERE slot_name = '$Slot' AND wal_status = 'lost'") -eq '1')
}
$SlotLostMessage = "Replication slot $Slot da mat (WAL giu cho slot vuot 512MB) - chay .\scripts\cdc-off.ps1 roi .\scripts\cdc-on.ps1. Polling van bat, khong mat su kien."

function Test-DebeziumRunning {
    return ((docker ps --filter 'name=^debezium$' --format '{{.Names}}') -eq 'debezium')
}

# true neu project-task-service dang chay polling (khong co ENABLE_OUTBOX_POLLING=false trong env).
function Test-PollingEnabled {
    $envs = docker inspect project-task-service --format '{{range .Config.Env}}{{println .}}{{end}}'
    if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc env cua container project-task-service' }
    # 25/10/2026 (fix ra soat CDC): bo qua khoang trang nhu app (trim().toLowerCase()); -match
    # cua PowerShell von khong phan biet hoa thuong.
    return -not ($envs -match '^ENABLE_OUTBOX_POLLING=\s*false\s*$')
}

# Tao lai project-task-service voi co polling moi va cho healthy. Dat qua bien moi truong cua shell
# (uu tien hon infra/.env) chu khong sua .env: neu sau nay ai do chay `docker compose up -d` thuong,
# container quay ve mac dinh true - toi da chi trung lap su kien, khong bao gio mat.
function Set-OutboxPolling([bool]$Enabled) {
    $env:ENABLE_OUTBOX_POLLING = if ($Enabled) { 'true' } else { 'false' }
    try { Invoke-Compose up -d --no-deps --wait project-task-service }
    finally { Remove-Item Env:ENABLE_OUTBOX_POLLING -ErrorAction SilentlyContinue }
}
