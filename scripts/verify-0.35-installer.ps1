param(
  [switch]$Help,
  [string]$InstallerPath,
  [string]$OutputDir = ".dev\release-evidence",
  [string]$PythonExe = "python",
  [switch]$AppLaunched,
  [switch]$WorkerReachable
)

$ErrorActionPreference = "Stop"

function Show-Usage {
  Write-Host "Usage:"
  Write-Host "  .\scripts\verify-0.35-installer.ps1 -InstallerPath <path> -AppLaunched -WorkerReachable [-OutputDir <dir>] [-PythonExe <path>]"
}

if ($Help) {
  Show-Usage
  exit 0
}

$status = "pass"
$notes = @()

if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
  $status = "fail"
  $InstallerPath = ".missing-installer"
  $notes += "InstallerPath was not provided."
} elseif (-not (Test-Path -LiteralPath $InstallerPath)) {
  $status = "fail"
  $notes += "Installer artifact was not found."
}

if (-not $AppLaunched) {
  $status = "fail"
  $notes += "Installed app launch was not confirmed."
}

if (-not $WorkerReachable) {
  $status = "fail"
  $notes += "Worker reachability from the installed app was not confirmed."
}

$argsList = @(
  "-m", "diplomat_worker.release.evidence",
  "--kind", "installer",
  "--status", $status,
  "--output", $OutputDir,
  "--artifact", "installer=$InstallerPath",
  "--metric", "appLaunched=$($AppLaunched.IsPresent)",
  "--metric", "workerReachable=$($WorkerReachable.IsPresent)"
)

foreach ($note in $notes) {
  $argsList += @("--note", $note)
}

& $PythonExe @argsList
exit $LASTEXITCODE
