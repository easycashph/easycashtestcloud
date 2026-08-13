# Easycash LMS - Cloudflare Tunnel with Auto-Update
#
# 2026-08-13: replaces the manual "copy the new URL, paste into Cloudflare Pages dashboard,
# retry deployment" steps in `Start Cloudflare Tunnel.bat` with an automated version. Still uses
# a free `trycloudflare.com` QUICK tunnel (no domain owned yet - a Named Tunnel needs a domain
# added to Cloudflare, which this office doesn't have), so the URL still changes every run - this
# script just does the update-and-redeploy for you instead of by hand.
#
# SETUP (one-time, run this once before using the script for real):
#   1. Cloudflare dashboard -> My Profile -> API Tokens -> Create Token -> "Edit Cloudflare Pages"
#      template (or a custom token with Account > Cloudflare Pages > Edit permission).
#   2. Run this script once - it will notice `local/tunnel-autoupdate.env` is missing, create a
#      blank template for you, and stop. Fill in the three values it asks for, then run again.
#
# The token lives ONLY in `local/tunnel-autoupdate.env` on this machine - that whole folder is
# gitignored (see local/README.md), so it never reaches git/GitHub.

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $RepoRoot 'local\tunnel-autoupdate.env'
$CloudflaredExe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'

function Write-Step($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Warn2($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err2($msg) { Write-Host $msg -ForegroundColor Red }

Write-Host '============================================'
Write-Host '  Easycash LMS - Cloudflare Tunnel (Auto-Update)'
Write-Host '============================================'
Write-Host ''

# --- Step 0: config ---
if (-not (Test-Path $ConfigPath)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath) | Out-Null
    @"
# Cloudflare API config for the tunnel auto-update script.
# This file is gitignored (see local/README.md) - never commit it.
#
# CLOUDFLARE_API_TOKEN: dashboard -> My Profile -> API Tokens -> Create Token
#   -> "Edit Cloudflare Pages" template.
CLOUDFLARE_API_TOKEN=
# Already known for this account:
CLOUDFLARE_ACCOUNT_ID=1bc783e8bf1094f9380eb287df388683
# The Pages project name (from the easycash-lms.pages.dev URL - confirm this matches your
# Cloudflare dashboard's Workers & Pages project name exactly, case-sensitive).
CLOUDFLARE_PAGES_PROJECT=easycash-lms
"@ | Set-Content -Encoding utf8 $ConfigPath

    Write-Warn2 "First run - created a blank config at:"
    Write-Warn2 "  $ConfigPath"
    Write-Warn2 "Fill in CLOUDFLARE_API_TOKEN (and double-check the other two values), then run this script again."
    Read-Host 'Press Enter to exit'
    exit 1
}

$config = @{}
Get-Content $ConfigPath | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) { $config[$parts[0].Trim()] = $parts[1].Trim() }
}
$ApiToken = $config['CLOUDFLARE_API_TOKEN']
$AccountId = $config['CLOUDFLARE_ACCOUNT_ID']
$ProjectName = $config['CLOUDFLARE_PAGES_PROJECT']

if ([string]::IsNullOrWhiteSpace($ApiToken) -or [string]::IsNullOrWhiteSpace($AccountId) -or [string]::IsNullOrWhiteSpace($ProjectName)) {
    Write-Err2 "local/tunnel-autoupdate.env is missing a value (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_PAGES_PROJECT)."
    Write-Err2 "Edit that file and fill in all three, then run this script again."
    Read-Host 'Press Enter to exit'
    exit 1
}

if (-not (Test-Path $CloudflaredExe)) {
    Write-Err2 "cloudflared.exe not found at: $CloudflaredExe"
    Write-Err2 "Install it first: winget install --id Cloudflare.cloudflared -e"
    Read-Host 'Press Enter to exit'
    exit 1
}

# --- Step 1: backend health check ---
Write-Step '[1/4] Checking backend on localhost:4000...'
try {
    Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host '      OK.'
} catch {
    Write-Err2 '      Backend is not responding on port 4000. Start the Docker backend container first (docker compose up).'
    Read-Host 'Press Enter to exit'
    exit 1
}

# --- Step 2: start the tunnel, capture its output ---
Write-Step '[2/4] Starting cloudflared tunnel...'
$runId = [guid]::NewGuid()
$stdoutPath = Join-Path $env:TEMP "cloudflared-tunnel-$runId.out.log"
$stderrPath = Join-Path $env:TEMP "cloudflared-tunnel-$runId.err.log"
$proc = Start-Process -FilePath $CloudflaredExe -ArgumentList 'tunnel', '--url', 'http://localhost:4000' `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -WindowStyle Hidden

$tunnelUrl = $null
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
    Start-Sleep -Milliseconds 500
    foreach ($logPath in @($stderrPath, $stdoutPath)) {
        if (-not $tunnelUrl -and (Test-Path $logPath)) {
            $content = Get-Content $logPath -Raw -ErrorAction SilentlyContinue
            if ($content -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $tunnelUrl = $Matches[0]
            }
        }
    }
}

if (-not $tunnelUrl) {
    Write-Err2 '      Timed out waiting for the tunnel URL. Check the logs:'
    Write-Err2 "      $stdoutPath"
    Write-Err2 "      $stderrPath"
    Read-Host 'Press Enter to exit'
    exit 1
}
Write-Host "      Tunnel URL: $tunnelUrl"
Write-Host "      (cloudflared is running in the background, PID $($proc.Id) - do not close this window, it stops the tunnel.)"

# --- Step 3: update the Pages project's VITE_API_BASE_URL env var ---
Write-Step '[3/4] Updating VITE_API_BASE_URL on Cloudflare Pages...'
$apiBase = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName"
$headers = @{ Authorization = "Bearer $ApiToken"; 'Content-Type' = 'application/json' }

function Get-CloudflareErrorDetail($errRecord) {
    if ($errRecord.ErrorDetails -and $errRecord.ErrorDetails.Message) {
        return $errRecord.ErrorDetails.Message
    }
    return $errRecord.Exception.Message
}

try {
    $project = Invoke-RestMethod -Uri $apiBase -Headers $headers -Method Get
} catch {
    Write-Err2 "      Could not read the Pages project. Check CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_PAGES_PROJECT in local/tunnel-autoupdate.env."
    Write-Err2 "      $(Get-CloudflareErrorDetail $_)"
    Read-Host 'Press Enter to exit'
    exit 1
}

# Minimal body - only env_vars, not the full deployment_configs.production object from GET
# (that round-trip pulled in read-only/computed fields that Cloudflare's PATCH rejected with a
# generic 400). PATCH replaces env_vars wholesale, not per-key, so existing vars are merged in
# here on the client side rather than relying on the API to merge them.
$existingEnvVars = $project.result.deployment_configs.production.env_vars
$envVarsHash = @{}
if ($existingEnvVars) {
    $existingEnvVars.PSObject.Properties | ForEach-Object { $envVarsHash[$_.Name] = $_.Value }
}
$envVarsHash['VITE_API_BASE_URL'] = @{ value = "$tunnelUrl/api/v1" }

$patchBody = @{ deployment_configs = @{ production = @{ env_vars = $envVarsHash } } } | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri $apiBase -Headers $headers -Method Patch -Body $patchBody | Out-Null
    Write-Host '      OK.'
} catch {
    Write-Err2 "      Failed to update the env var:"
    Write-Err2 "      $(Get-CloudflareErrorDetail $_)"
    Read-Host 'Press Enter to exit'
    exit 1
}

# --- Step 4: trigger a new build so the new env var is actually baked in ---
Write-Step '[4/4] Triggering a new deployment...'
try {
    $deployments = Invoke-RestMethod -Uri "$apiBase/deployments" -Headers $headers -Method Get
    $latest = $deployments.result | Select-Object -First 1
    if (-not $latest) {
        Write-Err2 '      No existing deployment found to retry from. Trigger one manually from the Pages dashboard once, then re-run this script.'
        Read-Host 'Press Enter to exit'
        exit 1
    }
    Invoke-RestMethod -Uri "$apiBase/deployments/$($latest.id)/retry" -Headers $headers -Method Post | Out-Null
    Write-Host '      OK - a new build has started. It usually takes 1-2 minutes.'
} catch {
    Write-Err2 "      Failed to trigger the deployment:"
    Write-Err2 "      $(Get-CloudflareErrorDetail $_)"
    Write-Err2 '      The env var was updated, but you will need to click "Retry deployment" manually in the Pages dashboard.'
    Read-Host 'Press Enter to exit'
    exit 1
}

Write-Host ''
Write-Host '============================================'
Write-Host '  Done. https://easycash-lms.pages.dev will'
Write-Host '  point at the new tunnel URL once the build'
Write-Host '  above finishes (check the Pages dashboard).'
Write-Host ''
Write-Host '  KEEP THIS WINDOW OPEN - closing it stops the'
Write-Host '  tunnel.'
Write-Host '============================================'
Write-Host ''
Wait-Process -Id $proc.Id
