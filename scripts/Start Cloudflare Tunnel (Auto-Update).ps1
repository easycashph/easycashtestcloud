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

param(
    # Passed by the scheduled task (see local/README.md) so unattended runs never block on a
    # Read-Host prompt that nobody is there to answer - errors just get logged and the script exits.
    [switch]$Unattended
)

function Wait-Or-Exit($msg) {
    Write-Err2 $msg
    if (-not $Unattended) { Read-Host 'Press Enter to exit' }
    exit 1
}

$ErrorActionPreference = 'Stop'

# 2026-09-04 (recurrence of the 2026-09-03 "(304) Not Modified" bug - this time on the SECOND
# Invoke-RestMethod call in the run, Portal, right after LMS's identical call succeeded): the
# per-request no-cache headers + cache-buster query param added to Update-PagesProject below were
# not sufficient on their own - WinINet's cache is process-wide, and Invoke-RestMethod has no
# per-call way to set System.Net.WebRequest's CachePolicy, so a header hint can still be
# overridden by whatever the shared HttpWebRequest cache layer decided on an earlier call in the
# same process. Setting the DEFAULT cache policy for the whole process (documented fix for this
# exact PowerShell 5.1 symptom) is the more reliable layer - every Invoke-RestMethod call below
# inherits it, not just the one that happened to hit the bug last time.
Add-Type -TypeDefinition @"
using System.Net.Cache;
public class NoCachePolicy : RequestCachePolicy {
    public NoCachePolicy() : base(RequestCacheLevel.NoCacheNoStore) {}
}
"@
[System.Net.WebRequest]::DefaultCachePolicy = New-Object NoCachePolicy

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
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
# 2026-08-18: the Easycash Portal's Pages project (easycash-portal.pages.dev) - same backend
# tunnel, updated and redeployed right alongside the LMS project above every run.
CLOUDFLARE_PAGES_PROJECT_PORTAL=easycash-portal
"@ | Set-Content -Encoding utf8 $ConfigPath

    Write-Warn2 "First run - created a blank config at:"
    Write-Warn2 "  $ConfigPath"
    Write-Warn2 "Fill in CLOUDFLARE_API_TOKEN (and double-check the other two values), then run this script again."
    if (-not $Unattended) { Read-Host 'Press Enter to exit' }
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
# 2026-08-18: optional - older config files from before the Portal was added to this script won't
# have this key yet. Warn and skip the Portal update rather than hard-failing the whole run over
# a project that may be deliberately unconfigured on some other machine.
$PortalProjectName = $config['CLOUDFLARE_PAGES_PROJECT_PORTAL']

if ([string]::IsNullOrWhiteSpace($ApiToken) -or [string]::IsNullOrWhiteSpace($AccountId) -or [string]::IsNullOrWhiteSpace($ProjectName)) {
    Write-Err2 "local/tunnel-autoupdate.env is missing a value (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_PAGES_PROJECT)."
    Write-Err2 "Edit that file and fill in all three, then run this script again."
    Read-Host 'Press Enter to exit'
    exit 1
}

if (-not (Test-Path $CloudflaredExe)) {
    Wait-Or-Exit "cloudflared.exe not found at: $CloudflaredExe`nInstall it first: winget install --id Cloudflare.cloudflared -e"
}

# --- Step 1: backend health check ---
# Retries for up to 5 minutes so a boot-time run (Task Scheduler "At log on") doesn't fail just
# because Docker Desktop/the containers are still starting up - unattended runs have nobody around
# to notice a one-shot failure and re-run it by hand.
Write-Step '[1/4] Checking backend on localhost:4000...'
$backendDeadline = (Get-Date).AddMinutes(5)
$backendUp = $false
while ((Get-Date) -lt $backendDeadline -and -not $backendUp) {
    try {
        Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing -TimeoutSec 5 | Out-Null
        $backendUp = $true
    } catch {
        Write-Host '      Not up yet, retrying...'
        Start-Sleep -Seconds 10
    }
}
if (-not $backendUp) {
    Wait-Or-Exit '      Backend never came up on port 4000 after 5 minutes. Start the Docker backend container first (docker compose up).'
}
Write-Host '      OK.'

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
    Wait-Or-Exit "      Timed out waiting for the tunnel URL. Check the logs:`n      $stdoutPath`n      $stderrPath"
}
Write-Host "      Tunnel URL: $tunnelUrl"
Write-Host "      (cloudflared is running in the background, PID $($proc.Id) - do not close this window, it stops the tunnel.)"

function Get-CloudflareErrorDetail($errRecord) {
    if ($errRecord.ErrorDetails -and $errRecord.ErrorDetails.Message) {
        return $errRecord.ErrorDetails.Message
    }
    return $errRecord.Exception.Message
}

# 2026-08-18: update-env-var + redeploy, extracted so it can run once per Pages project (LMS,
# Portal) against the same tunnel URL - both frontends call the same backend, so one tunnel serves
# both, they just each need their own VITE_API_BASE_URL update + redeploy triggered separately.
function Update-PagesProject($label, $projectName) {
    Write-Step "Updating VITE_API_BASE_URL on Cloudflare Pages ($label)..."
    $apiBase = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$projectName"
    # 2026-09-03 (user-reported: "(304) Not Modified" on the retry-deployment call): a known
    # Windows PowerShell 5.1 / .NET WinINet quirk, not a real Cloudflare response - Invoke-RestMethod
    # can serve a cached response (even for a POST) once this process has hit api.cloudflare.com
    # before in the same run. These two headers disable that local cache, matching Cloudflare's own
    # troubleshooting guidance for this exact symptom.
    $headers = @{
        Authorization  = "Bearer $ApiToken"
        'Content-Type' = 'application/json'
        'Cache-Control' = 'no-cache'
        'Pragma'        = 'no-cache'
    }

    try {
        $project = Invoke-RestMethod -Uri $apiBase -Headers $headers -Method Get
    } catch {
        Write-Err2 "      Could not read the $label Pages project ('$projectName'). Check CLOUDFLARE_PAGES_PROJECT / CLOUDFLARE_PAGES_PROJECT_PORTAL in local/tunnel-autoupdate.env.`n      $(Get-CloudflareErrorDetail $_)"
        return $false
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
        Write-Err2 "      Failed to update the env var for $label`: $(Get-CloudflareErrorDetail $_)"
        return $false
    }

    Write-Step "Triggering a new deployment ($label)..."
    try {
        $deployments = Invoke-RestMethod -Uri "$apiBase/deployments" -Headers $headers -Method Get
        $latest = $deployments.result | Select-Object -First 1
        if (-not $latest) {
            Write-Err2 "      No existing deployment found to retry from for $label. Trigger one manually from the Pages dashboard once, then re-run this script."
            return $false
        }
        # Cache-buster query param - a belt-and-suspenders second layer against the same WinINet
        # 304 issue the no-cache headers above target, in case a header alone isn't enough (this
        # specific POST call is where the user actually hit the error).
        $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        Invoke-RestMethod -Uri "$apiBase/deployments/$($latest.id)/retry?_=$cacheBuster" -Headers $headers -Method Post | Out-Null
        Write-Host '      OK - a new build has started. It usually takes 1-2 minutes.'
        return $true
    } catch {
        Write-Err2 "      Failed to trigger the deployment for $label`: $(Get-CloudflareErrorDetail $_)`n      The env var was updated, but you will need to click ""Retry deployment"" manually in the Pages dashboard."
        return $false
    }
}

# --- Step 3: update + redeploy both Pages projects ---
Write-Step '[3/4] Updating Cloudflare Pages projects...'
$lmsOk = Update-PagesProject 'LMS' $ProjectName
# 2026-09-14 (user request): Portal re-enabled again - restored the update-and-redeploy call
# disabled on 2026-09-10, mirroring the same re-enable done once before that day.
$portalOk = $true
if ([string]::IsNullOrWhiteSpace($PortalProjectName)) {
    Write-Warn2 "      CLOUDFLARE_PAGES_PROJECT_PORTAL not set in local/tunnel-autoupdate.env - skipping the Portal update. Add it (e.g. easycash-portal) to include the Portal in this script."
} else {
    $portalOk = Update-PagesProject 'Portal' $PortalProjectName
}

# --- Step 4: summary ---
Write-Step '[4/4] Done.'
if (-not $lmsOk -or -not $portalOk) {
    Wait-Or-Exit '      One or more Pages projects failed to update - see the errors above.'
}

Write-Host ''
Write-Host '============================================'
Write-Host '  Done. https://easycash-lms.pages.dev and'
Write-Host '  https://easycash-portal.pages.dev will point'
Write-Host '  at the new tunnel URL once their builds finish'
Write-Host '  (check the Pages dashboard).'
Write-Host ''
Write-Host '  KEEP THIS WINDOW OPEN - closing it stops the'
Write-Host '  tunnel.'
Write-Host '============================================'
Write-Host ''
Wait-Process -Id $proc.Id
