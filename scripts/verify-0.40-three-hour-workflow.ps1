param(
  [switch]$Help,
  [Parameter(Mandatory = $false)][string]$MediaPath,
  [Parameter(Mandatory = $false)][string]$AsrModelDir = ".\models\dev\asr\microsoft--VibeVoice-ASR",
  [Parameter(Mandatory = $false)][string]$TranslationModelDir = ".\models\dev\translation\tencent--Hunyuan-MT-7B-fp8",
  [Parameter(Mandatory = $false)][string]$GlossaryPath,
  [Parameter(Mandatory = $false)][string]$OutputDir = ".\.dev\release-evidence\0.40",
  [switch]$PreflightOnly,
  [string]$PythonExe = "python",
  [string]$FfmpegPath = "ffmpeg",
  [string]$FfprobePath = "ffprobe",
  [string]$SourceLanguage = "zh",
  [string]$TargetLanguage = "en",
  [ValidateSet("release", "smoke")]
  [string]$AcceptanceProfile = "release"
)

$ErrorActionPreference = "Stop"

function Show-Usage {
  Write-Host "Usage:"
  Write-Host "  .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <ten-minute-video> -AcceptanceProfile smoke -SourceLanguage en -TargetLanguage zh"
  Write-Host "  .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <two-to-three-hour-video> -AcceptanceProfile release -AsrModelDir .\models\dev\asr\microsoft--VibeVoice-ASR -TranslationModelDir .\models\dev\translation\tencent--Hunyuan-MT-7B-fp8 -GlossaryPath .\glossary.json -OutputDir .\.dev\release-evidence\0.40"
  Write-Host "  .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <video> -AcceptanceProfile smoke -PreflightOnly"
  Write-Host ""
  Write-Host "Runs the Diplomat 0.40 acceptance workflow and writes acceptance-summary.json under OutputDir. Use -AcceptanceProfile smoke for short-video full workflow validation, release for the final 2-3 hour gate, and -PreflightOnly to validate media and model readiness without starting ASR or translation."
}

if ($Help) {
  Show-Usage
  exit 0
}

if ([string]::IsNullOrWhiteSpace($MediaPath)) {
  Write-Error "MediaPath is required."
}

$resolvedMedia = Resolve-Path -LiteralPath $MediaPath -ErrorAction Stop
$resolvedAsrModelDir = Resolve-Path -LiteralPath $AsrModelDir -ErrorAction Stop
$resolvedTranslationModelDir = Resolve-Path -LiteralPath $TranslationModelDir -ErrorAction Stop
$resolvedGlossaryPath = $null
if (-not [string]::IsNullOrWhiteSpace($GlossaryPath)) {
  $resolvedGlossaryPath = Resolve-Path -LiteralPath $GlossaryPath -ErrorAction Stop
}
$resolvedOutputDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

Write-Host "Diplomat 0.40 workflow verification"
Write-Host "  Media: $resolvedMedia"
Write-Host "  Acceptance profile: $AcceptanceProfile"
Write-Host "  ASR model dir: $resolvedAsrModelDir"
Write-Host "  Translation model dir: $resolvedTranslationModelDir"
if ($null -ne $resolvedGlossaryPath) {
  Write-Host "  Glossary: $resolvedGlossaryPath"
}
Write-Host "  Evidence: $resolvedOutputDir"

$argsList = @(
  "scripts\acceptance\run-0-40-three-hour.py",
  "--source-video", $resolvedMedia.Path,
  "--evidence-dir", $resolvedOutputDir,
  "--ffmpeg-path", $FfmpegPath,
  "--ffprobe-path", $FfprobePath,
  "--source-language", $SourceLanguage,
  "--target-language", $TargetLanguage,
  "--acceptance-profile", $AcceptanceProfile
)

if ($null -ne $resolvedGlossaryPath) {
  $argsList += @("--glossary-path", $resolvedGlossaryPath.Path)
}
if ($PreflightOnly) {
  $argsList += "--preflight-only"
}

& $PythonExe @argsList
exit $LASTEXITCODE
