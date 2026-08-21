# Easycash LMS - Remote Postgres Snapshot Backup
#
# 2026-08-20 (user request - Jomer + Nomer, extended same day so it also works on "ibang
# computer" - any teammate's machine, not just the one it was first written on): pulls a fresh
# pg_dump snapshot straight from the office server's live Postgres, over the network, the same way
# a fresh MongoDB dump is pulled from the SDevTech server (see `scripts/Update Database From
# SDevTech.bat`'s own doc comment) - except here the connection is direct (the office server's
# Postgres port is reachable on the network/internet), so no manual zip-and-drop step is needed -
# this script connects and pulls.
#
# Uses the LOCAL Docker Postgres container's own `pg_dump` client tool to connect OUT to the
# remote server (`-h`/`-p` point at the remote host, not the local container) - there's no need
# for a separate Postgres client install on this Windows machine, just Docker Desktop with the
# LMS's own docker-compose stack (app\docker) already set up, same as every dev machine.
#
# This script itself is TRACKED (lives in scripts/, not local/) - it holds no credentials, only
# logic, so it travels with the repo to any machine that clones it. Only the connection details
# file below is gitignored.
#
# SETUP (one-time per machine): this script reads connection details from
# `local/postgres-remote-backup.env` (gitignored - never commit real credentials). If that file
# doesn't exist yet, this script creates a blank template and stops - fill in the four values,
# then run again.
#
# Output: `local/backups/remote/easycash_remote_<timestamp>.dump` (pg_dump custom format - restore
# with `pg_restore`). Old snapshots (7+ days) are pruned automatically, same retention as the local
# backup-database.ps1 script.

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot 'local\postgres-remote-backup.env'
$BackupDir = Join-Path $RepoRoot 'local\backups\remote'
$LogPath = Join-Path $BackupDir 'backup.log'

function Write-Step($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn2($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err2($msg) { Write-Host $msg -ForegroundColor Red }
function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogPath -Value $line
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

if (-not (Test-Path $ConfigPath)) {
    @'
# Remote Postgres connection details (office server) - fill in, then re-run the backup script.
# Never commit this file - it lives under local/, which is gitignored.
REMOTE_PG_HOST=
REMOTE_PG_PORT=5432
REMOTE_PG_DB=easycash
REMOTE_PG_USER=
REMOTE_PG_PASSWORD=
'@ | Set-Content -Path $ConfigPath -Encoding utf8
    Write-Warn2 "Ginawa ang blangkong config file sa: $ConfigPath"
    Write-Warn2 "Punan muna ang REMOTE_PG_HOST/PORT/DB/USER/PASSWORD, tapos patakbuhin ulit ang script na ito."
    exit 1
}

$config = @{}
Get-Content $ConfigPath | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) { $config[$parts[0].Trim()] = $parts[1].Trim() }
}

foreach ($key in @('REMOTE_PG_HOST', 'REMOTE_PG_PORT', 'REMOTE_PG_DB', 'REMOTE_PG_USER', 'REMOTE_PG_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace($config[$key])) {
        Write-Err2 "Kulang ang '$key' sa $ConfigPath - punan muna ito."
        exit 1
    }
}

Write-Host '============================================'
Write-Host '  Easycash LMS - Remote Postgres Snapshot'
Write-Host '============================================'
Write-Host ''

Write-Step "[1/3] Chinicheck kung tumatakbo ang local Postgres container (ginagamit lang ang pg_dump tool nito)..."
$running = docker inspect -f '{{.State.Running}}' easycash-postgres-1 2>$null
if ($running -ne 'true') {
    Write-Err2 'Hindi tumatakbo ang easycash-postgres-1 container. Patakbuhin muna ang docker compose stack (app\docker), tapos ulitin.'
    Write-Log 'FAILED - local postgres container not running'
    exit 1
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$dumpFileName = "easycash_remote_$timestamp.dump"
$containerTmpPath = "/tmp/$dumpFileName"
$localPath = Join-Path $BackupDir $dumpFileName

Write-Step "[2/3] Kumukuha ng snapshot mula sa $($config.REMOTE_PG_HOST):$($config.REMOTE_PG_PORT)/$($config.REMOTE_PG_DB) (maaaring tumagal, depende sa laki ng database)..."
docker exec -e PGPASSWORD=$($config.REMOTE_PG_PASSWORD) easycash-postgres-1 pg_dump `
    -h $config.REMOTE_PG_HOST -p $config.REMOTE_PG_PORT -U $config.REMOTE_PG_USER -d $config.REMOTE_PG_DB `
    -F c -f $containerTmpPath
if ($LASTEXITCODE -ne 0) {
    Write-Err2 'Nabigo ang pg_dump - suriin ang connection details sa config file at ang network access papunta sa office server.'
    Write-Log "FAILED - pg_dump exit code $LASTEXITCODE"
    exit 1
}

# 2026-08-21 (user-reported): $ErrorActionPreference = 'Stop' does NOT apply to external/native
# commands like `docker` - only $LASTEXITCODE does, and only where actually checked. `docker cp`
# and the cleanup `rm` below went unchecked, so a failed copy (disk full, permission issue) still
# fell through to the "OK - na-save" message and log line - a false-positive success with no file,
# or an incomplete one, that would only be discovered when the backup was actually needed.
docker cp "easycash-postgres-1:$containerTmpPath" $localPath
if ($LASTEXITCODE -ne 0) {
    Write-Err2 "Nabigo ang docker cp mula sa container patungong $localPath."
    Write-Log "FAILED - docker cp exit code $LASTEXITCODE"
    docker exec easycash-postgres-1 rm -f $containerTmpPath
    exit 1
}
docker exec easycash-postgres-1 rm -f $containerTmpPath
if ($LASTEXITCODE -ne 0) {
    Write-Warn2 "Hindi nabura ang container temp file ($containerTmpPath) - hindi ito seryosong problema (naiwan lang ang scratch file sa container), pero itala natin ito."
    Write-Log "WARNING - could not remove container temp file $containerTmpPath (exit code $LASTEXITCODE)"
}

$localFile = Get-Item $localPath -ErrorAction SilentlyContinue
if (-not $localFile -or $localFile.Length -eq 0) {
    Write-Err2 "Nag-report ng success ang docker cp pero walang laman o wala talaga ang file sa: $localPath"
    Write-Log "FAILED - $dumpFileName missing or empty after docker cp"
    exit 1
}

$sizeMb = [math]::Round($localFile.Length / 1MB, 2)
Write-Host "      OK - na-save sa: $localPath ($sizeMb MB)"
Write-Log "OK - $dumpFileName ($sizeMb MB) from $($config.REMOTE_PG_HOST)/$($config.REMOTE_PG_DB)"

Write-Step '[3/3] Binuburang ang mga remote snapshot na mas matanda sa 7 araw...'
$cutoff = (Get-Date).AddDays(-7)
Get-ChildItem -Path $BackupDir -Filter 'easycash_remote_*.dump' |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Write-Host "      Binubura: $($_.Name)"
        Remove-Item $_.FullName -Force
    }

Write-Host ''
Write-Host '============================================'
Write-Host '  Tapos na!'
Write-Host '============================================'
