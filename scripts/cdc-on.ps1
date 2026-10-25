# 25/10/2026: BAT CDC Debezium cho bang outbox_events cua project-task-service (chi dung demo ngan).
# Chay tu thu muc goc repo: powershell -ExecutionPolicy Bypass -File .\scripts\cdc-on.ps1
# Tat lai bang scripts/cdc-off.ps1 (KHONG chi stop container - xem ly do trong file do).
#
# Thu tu buoc dam bao KHONG MAT su kien; doi lai co the TRUNG LAP vai su kien trong khoang ca polling
# lan CDC cung chay - vo hai vi analytics-service (ON CONFLICT eventId) va notification-service
# (unique eventId+userId) deu idempotent:
#  1. Bat polling neu dang tat (trang thai do dang tu lan chay truoc) - moi dong ton deu se duoc gui.
#  2. Bat debezium (+ tao lai postgres-pt neu chua co wal_level=logical).
#  3. Dang ky connector (PUT config = tao moi hoac cap nhat, chay lai an toan). snapshot.mode=no_data:
#     khong doc lai dong outbox cu, chi doc WAL tu luc tao slot.
#  4. Cho connector RUNNING + slot active: tu day MOI dong outbox moi commit deu do CDC gui.
#  5. Dong commit TRUOC khi co slot thi CDC khong thay -> polling (van chay) phai gui. Lay moc T0 sau
#     buoc 4, cho toi khi khong con dong published=false nao co created_at < T0.
#  6. Luc nay moi tat polling. Loi o bat ky buoc nao -> dung lai, polling van chay (an toan).
. (Join-Path $PSScriptRoot 'cdc-common.ps1')
$config = (Get-Content $ConnectorFile -Raw | ConvertFrom-Json).config | ConvertTo-Json -Depth 5

# 25/10/2026 (fix ra soat CDC): them dieu kien slot active - REST RUNNING khong du chung minh CDC dang
# doc WAL; thieu slot thi di du 6 buoc ben duoi (bat polling truoc nen an toan).
if ((Test-DebeziumRunning) -and (Test-ConnectorRunning) -and (Test-SlotActive) -and -not (Test-PollingEnabled)) {
    # Chay lai khi da BAT: chi cap nhat cau hinh connector (task khoi dong lai, doc tiep tu offset da
    # commit - toi da trung lap), khong dung toi polling.
    Invoke-RestMethod -Method Put "$ConnectUrl/connectors/$Connector/config" -Body $config -ContentType 'application/json' | Out-Null
    Write-Host 'CDC da BAT san (connector RUNNING, polling tat) - chi cap nhat cau hinh connector.' -ForegroundColor Green
    exit 0
}

Write-Host '[1/6] Dam bao Outbox polling dang bat...' -ForegroundColor Cyan
Set-OutboxPolling $true
# 25/10/2026 (fix ra soat CDC): slot 'lost' thi connector khong bao gio chay lai - bao ngay thay vi cho 90s.
if (Test-SlotLost) { throw $SlotLostMessage }

Write-Host '[2/6] Bat container debezium (profile cdc)...' -ForegroundColor Cyan
# 25/10/2026 (fix ra soat CDC): healthcheck debezium nay phan anh trang thai connector - container dang
# chay voi connector loi se khong healthy, --wait that bai: huong dan cach phuc hoi ro rang.
try { Invoke-Compose --profile cdc up -d --wait debezium }
catch { throw "debezium khong healthy (connector loi?) - polling van bat, khong mat su kien. Chay .\scripts\cdc-off.ps1 roi .\scripts\cdc-on.ps1. Chi tiet: $_" }
if ((Invoke-PtSql 'SHOW wal_level') -ne 'logical') { throw 'postgres-pt chua co wal_level=logical' }

Write-Host "[3/6] Dang ky connector '$Connector'..." -ForegroundColor Cyan
Invoke-RestMethod -Method Put "$ConnectUrl/connectors/$Connector/config" -Body $config -ContentType 'application/json' | Out-Null

Write-Host '[4/6] Cho connector RUNNING va replication slot active...' -ForegroundColor Cyan
$ready = Wait-Until { (Test-ConnectorRunning) -and (Test-SlotActive) } 'connector RUNNING + slot active'
if (-not $ready) {
    if (Test-SlotLost) { throw $SlotLostMessage }
    Get-ConnectorStatus | ConvertTo-Json -Depth 5 | Write-Host
    throw 'Connector chua chay - polling van bat, khong mat su kien. Xem: docker logs --tail 50 debezium'
}

Write-Host '[5/6] Cho polling gui het cac dong outbox commit truoc khi co slot...' -ForegroundColor Cyan
$t0 = Invoke-PtSql 'SELECT now()::text'
$drained = Wait-Until { (Invoke-PtSql "SELECT count(*) FROM outbox_events WHERE published = false AND created_at < '$t0'::timestamptz") -eq '0' } 'polling xa het dong ton' 60
if (-not $drained) { throw 'Con dong outbox chua gui duoc - giu polling bat (CDC + polling = chi trung lap). Xem log project-task-service roi chay lai.' }

Write-Host '[6/6] Tat Outbox polling (ENABLE_OUTBOX_POLLING=false)...' -ForegroundColor Cyan
Set-OutboxPolling $false

Write-Host "CDC da BAT: outbox_events -> Debezium -> Kafka topic project-task.events. Tat bang .\scripts\cdc-off.ps1" -ForegroundColor Green
