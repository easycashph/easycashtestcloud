# Scheduled backup of the working folder to Google Drive (via rclone).
# Excludes node_modules (regenerable via npm install), .git (already on GitHub),
# legacy/mongodb/extracted (regenerable by unzipping the .zip exports), and
# .tmp.driveupload (Google Drive's own upload staging folder).
# Logs each run to backup-to-google-drive.log in the same folder.

$rclone = "C:\Users\EASYCASH\AppData\Local\Microsoft\WinGet\Packages\Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe\rclone-v1.75.0-windows-amd64\rclone.exe"
$source = "C:\ECLC CLAUDE CODE"
$dest = "gdrive:ECLC CLAUDE CODE Backup"
$logFile = "C:\ECLC CLAUDE CODE\backup-to-google-drive.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "`n=== Backup started at $timestamp ==="

& $rclone sync $source $dest `
  --exclude "**/node_modules/**" `
  --exclude ".git/**" `
  --exclude "legacy/mongodb/extracted/**" `
  --exclude ".tmp.driveupload/**" `
  --log-file $logFile --log-level INFO

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "=== Backup finished at $timestamp (exit code $LASTEXITCODE) ==="
