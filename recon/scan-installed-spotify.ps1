<#
  Statically triage the Spotify desktop client already installed on this PC with Clearbox.
  Nothing is executed, modified, or uploaded: Clearbox only reads files and writes a report here.

  Usage (PowerShell, from the my-spotify folder):
    py -3 -m pip install git+https://github.com/vosbek/reverse-enginer-rea
    powershell -ExecutionPolicy Bypass -File recon\scan-installed-spotify.ps1
#>
param(
  [string]$Target = (Join-Path $env:APPDATA 'Spotify'),
  [string]$Out = (Join-Path $PSScriptRoot 'installed-client')
)
if (-not (Test-Path $Target)) {
  Write-Host "No Spotify install found at $Target. Pass -Target 'C:\path\to\Spotify' if it lives elsewhere."
  exit 1
}
$py = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }
& $py -3 -m clearbox scan $Target -t binary-triage --label 'Spotify desktop (installed)' -o $Out
if ($LASTEXITCODE -eq 0) { Start-Process (Join-Path $Out 'index.html') }
