# Run this before `docker compose up -d --build` (from app/docker) so the resulting image knows
# exactly which commit it was built from - see buildInfo.ts's doc comment for why (cross-machine
# version drift detection, 2026-08-30 user request).
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$commit = (git rev-parse --short HEAD).Trim()
$commitDate = (git log -1 --format=%cI).Trim()
$commitMessage = (git log -1 --format=%s).Trim()
$builtAt = (Get-Date).ToUniversalTime().ToString('o')

$json = @{
    commit        = $commit
    commitDate    = $commitDate
    commitMessage = $commitMessage
    builtAt       = $builtAt
} | ConvertTo-Json

$json | Out-File -Encoding utf8 -NoNewline (Join-Path $PSScriptRoot '..\app\easycashbackend\build-info.json')
$json | Out-File -Encoding utf8 -NoNewline (Join-Path $PSScriptRoot '..\app\lmsfrontend\public\build-info.json')

Write-Host "build-info.json written: $commit ($commitDate)"
