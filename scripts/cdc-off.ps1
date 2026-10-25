# 25/10/2026: TAT CDC Debezium, tra project-task-service ve Outbox polling. Chay lai nhieu lan an toan.
# Chay tu thu muc goc repo: powershell -ExecutionPolicy Bypass -File .\scripts\cdc-off.ps1
#
# Vi sao khong chi `docker stop debezium`: (a) replication slot con lai se bat Postgres giu WAL cho no
# (da chan o 512MB bang max_slot_wal_keep_size, nhung van phi dia); (b) trong luc CDC chay, polling
# tat nen cac dong outbox CDC da gui van published=false - bat lai polling ngay se gui lai ca loat.
#
# Thu tu buoc (khong mat su kien; chi co the trung lap vai su kien sinh trong luc dang tat):
#  1. CDC VAN CHAY. Lay moc T1 = now(), cho het transaction nao bat dau truoc T1, roi lay L1 =
#     vi tri WAL hien tai: moi dong co created_at < T1 (created_at = now() cua transaction ghi) chac
#     chan da commit truoc L1.
#  2. Kich 1 UPDATE khong doi du lieu vao outbox_events (EventRouter bo qua UPDATE, khong sinh su
#     kien) de CDC co thay doi moi sau L1, roi cho confirmed_flush_lsn cua slot > L1. Debezium chi xac
#     nhan LSN sau khi Kafka Connect da commit offset, tuc moi ban ghi truoc do da duoc Kafka ack.
#  3. Danh dau published=true cho dong published=false co created_at < T1 (da chac chan toi Kafka).
#     Dong sinh sau T1 giu nguyen false -> polling gui lai (trung lap it, vo hai). Het thoi gian cho
#     o buoc 1-2 thi BO QUA buoc 3: polling gui lai het (trung lap nhieu hon nhung khong mat).
#  4. Bat lai polling TRUOC khi xoa connector - khong co khoang nao vang ca 2 nguon publish.
#  5. Xoa connector, stop debezium, drop replication slot + publication.
. (Join-Path $PSScriptRoot 'cdc-common.ps1')

$debeziumUp = Test-DebeziumRunning
$cdcActive = $debeziumUp -and (Test-ConnectorRunning) -and
    ((Invoke-PtSql "SELECT count(*) FROM pg_replication_slots WHERE slot_name = '$Slot' AND active") -eq '1')

if ($cdcActive -and -not (Test-PollingEnabled)) {
    Write-Host '[1/5] Cho cac transaction dang mo ket thuc, chot moc T1/L1...' -ForegroundColor Cyan
    $t1 = Invoke-PtSql 'SELECT now()::text'
    $idle = Wait-Until { (Invoke-PtSql "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid() AND xact_start < '$t1'::timestamptz") -eq '0' } 'transaction cu ket thuc' 30
    $confirmed = $false
    if ($idle) {
        $l1 = Invoke-PtSql 'SELECT pg_current_wal_lsn()::text'
        Write-Host '[2/5] Cho Debezium xac nhan da gui toi Kafka moi thay doi truoc L1...' -ForegroundColor Cyan
        Invoke-PtSql 'UPDATE outbox_events SET published = published WHERE id = (SELECT id FROM outbox_events ORDER BY created_at DESC LIMIT 1)' | Out-Null
        $confirmed = Wait-Until { (Invoke-PtSql "SELECT confirmed_flush_lsn > '$l1'::pg_lsn FROM pg_replication_slots WHERE slot_name = '$Slot'") -eq 't' } 'confirmed_flush_lsn vuot L1' 60
    }
    if ($confirmed) {
        $marked = Invoke-PtSql "WITH u AS (UPDATE outbox_events SET published = true WHERE published = false AND created_at < '$t1'::timestamptz RETURNING 1) SELECT count(*) FROM u"
        Write-Host "[3/5] Da danh dau $marked dong outbox CDC da gui (polling se khong gui lai)." -ForegroundColor Cyan
    } else {
        Write-Host '[3/5] Khong xac nhan duoc - KHONG danh dau, polling se gui lai (chi trung lap).' -ForegroundColor Yellow
    }
} else {
    Write-Host '[1-3/5] CDC khong o trang thai dang chay day du - bo qua buoc danh dau.' -ForegroundColor Yellow
}

Write-Host '[4/5] Bat lai Outbox polling...' -ForegroundColor Cyan
Set-OutboxPolling $true

Write-Host '[5/5] Xoa connector, stop debezium, drop replication slot...' -ForegroundColor Cyan
if ($debeziumUp -and (Get-ConnectorStatus)) {
    # Xoa ca offset da luu (chi lam duoc khi connector STOPPED) - lan cdc-on.ps1 sau bat dau sach tu
    # slot moi, khong doi doc tiep LSN cu khong con tren server.
    Invoke-RestMethod -Method Put "$ConnectUrl/connectors/$Connector/stop" | Out-Null
    if (Wait-Until { (Get-ConnectorStatus).connector.state -eq 'STOPPED' } 'connector STOPPED' 30) {
        try { Invoke-RestMethod -Method Delete "$ConnectUrl/connectors/$Connector/offsets" | Out-Null } catch { Write-Host "Khong xoa duoc offset: $_" -ForegroundColor Yellow }
    }
    Invoke-RestMethod -Method Delete "$ConnectUrl/connectors/$Connector" | Out-Null
}
Invoke-Compose --profile cdc stop debezium
$released = Wait-Until { (Invoke-PtSql "SELECT count(*) FROM pg_replication_slots WHERE slot_name = '$Slot' AND active") -eq '0' } 'slot duoc giai phong' 30
if (-not $released) { throw "Slot $Slot van active - chay lai script nay sau it giay." }
Invoke-PtSql "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name = '$Slot'" | Out-Null
Invoke-PtSql "DROP PUBLICATION IF EXISTS $Publication" | Out-Null

Write-Host 'CDC da TAT: polling bat, debezium dung, replication slot da xoa.' -ForegroundColor Green
