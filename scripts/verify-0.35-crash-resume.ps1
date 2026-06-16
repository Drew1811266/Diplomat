param(
  [switch]$Help,
  [string]$ProjectDir,
  [ValidateSet("asr", "translation")][string]$TaskType = "translation",
  [string]$DiagnosticLogPath,
  [string]$OutputDir = ".dev\release-evidence",
  [string]$PythonExe = "python",
  [switch]$CompletedBeforeInterrupt,
  [switch]$CompletedAfterRetry
)

$ErrorActionPreference = "Stop"

function Show-Usage {
  Write-Host "Usage:"
  Write-Host "  .\scripts\verify-0.35-crash-resume.ps1 -ProjectDir <project-dir> -TaskType translation -CompletedBeforeInterrupt -CompletedAfterRetry [-DiagnosticLogPath <log>] [-PythonExe <path>]"
}

if ($Help) {
  Show-Usage
  exit 0
}

$status = "pass"
$notes = @()
$artifacts = @()

if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
  $status = "fail"
  $ProjectDir = ".missing-project"
  $notes += "ProjectDir was not provided."
} elseif (-not (Test-Path -LiteralPath $ProjectDir)) {
  $status = "fail"
  $notes += "Project directory artifact was not found."
}
$artifacts += "projectDir=$ProjectDir"

if (-not [string]::IsNullOrWhiteSpace($DiagnosticLogPath)) {
  if (-not (Test-Path -LiteralPath $DiagnosticLogPath)) {
    $status = "fail"
    $notes += "Diagnostic log artifact was not found."
  }
  $artifacts += "diagnosticLog=$DiagnosticLogPath"
}

if (-not $CompletedBeforeInterrupt) {
  $status = "fail"
  $notes += "Completed work before interruption was not confirmed."
}

if (-not $CompletedAfterRetry) {
  $status = "fail"
  $notes += "Completion after retry was not confirmed."
}

$argsList = @(
  "-m", "diplomat_worker.release.evidence",
  "--kind", "crash_resume",
  "--status", $status,
  "--output", $OutputDir,
  "--metric", "taskType=$TaskType",
  "--metric", "completedBeforeInterrupt=$($CompletedBeforeInterrupt.IsPresent)",
  "--metric", "completedAfterRetry=$($CompletedAfterRetry.IsPresent)"
)

foreach ($artifact in $artifacts) {
  $argsList += @("--artifact", $artifact)
}

foreach ($note in $notes) {
  $argsList += @("--note", $note)
}

& $PythonExe @argsList
exit $LASTEXITCODE
