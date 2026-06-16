param(
  [switch]$Help,
  [ValidateSet("OneHour", "ThreeHour")][string]$Duration = "OneHour",
  [string]$MediaPath,
  [string]$SubtitlePath,
  [string]$BenchmarkPath,
  [string]$BurnInExportPath,
  [string]$OutputDir = ".dev\release-evidence",
  [string]$PythonExe = "python",
  [switch]$TranslationCompleted
)

$ErrorActionPreference = "Stop"

function Show-Usage {
  Write-Host "Usage:"
  Write-Host "  .\scripts\verify-0.35-long-video.ps1 -Duration OneHour -MediaPath <video> -SubtitlePath <subtitle> -BenchmarkPath <json> -BurnInExportPath <video> [-TranslationCompleted] [-PythonExe <path>]"
  Write-Host "  .\scripts\verify-0.35-long-video.ps1 -Duration ThreeHour -MediaPath <video> -SubtitlePath <subtitle> -BenchmarkPath <json> -TranslationCompleted [-PythonExe <path>]"
}

if ($Help) {
  Show-Usage
  exit 0
}

$status = "pass"
$notes = @()
$artifacts = @()

function Add-RequiredArtifact([string]$Label, [string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    $script:status = "fail"
    $script:notes += "$Label path was not provided."
    $PathValue = ".missing-$Label"
  } elseif (-not (Test-Path -LiteralPath $PathValue)) {
    $script:status = "fail"
    $script:notes += "$Label artifact was not found."
  }
  $script:artifacts += "$Label=$PathValue"
}

Add-RequiredArtifact "media" $MediaPath
Add-RequiredArtifact "subtitle" $SubtitlePath
Add-RequiredArtifact "benchmark" $BenchmarkPath

if ($Duration -eq "OneHour") {
  Add-RequiredArtifact "burnInExport" $BurnInExportPath
}

if ($Duration -eq "ThreeHour" -and -not $TranslationCompleted) {
  $status = "fail"
  $notes += "Three-hour translation completion or clean resume was not confirmed."
}

$argsList = @(
  "-m", "diplomat_worker.release.evidence",
  "--kind", "long_video",
  "--status", $status,
  "--output", $OutputDir,
  "--metric", "duration=$Duration",
  "--metric", "translationCompleted=$($TranslationCompleted.IsPresent)"
)

foreach ($artifact in $artifacts) {
  $argsList += @("--artifact", $artifact)
}

foreach ($note in $notes) {
  $argsList += @("--note", $note)
}

& $PythonExe @argsList
exit $LASTEXITCODE
