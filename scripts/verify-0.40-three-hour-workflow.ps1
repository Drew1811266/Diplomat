param(
  [switch]$Help,
  [Parameter(Mandatory = $false)][string]$MediaPath,
  [Parameter(Mandatory = $false)][string]$AsrModelDir = ".\models\dev\asr\microsoft--VibeVoice-ASR",
  [Parameter(Mandatory = $false)][string]$TranslationModelDir = ".\models\dev\translation\tencent--Hunyuan-MT-7B-fp8",
  [Parameter(Mandatory = $false)][string]$OutputDir = ".\.dev\release-evidence\0.40",
  [string]$PythonExe = "python",
  [string]$FfmpegPath = "ffmpeg",
  [string]$FfprobePath = "ffprobe",
  [string]$SourceLanguage = "zh",
  [string]$TargetLanguage = "en"
)

$ErrorActionPreference = "Stop"

function Show-Usage {
  Write-Host "Usage:"
  Write-Host "  .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <three-hour-video> -AsrModelDir .\models\dev\asr\microsoft--VibeVoice-ASR -TranslationModelDir .\models\dev\translation\tencent--Hunyuan-MT-7B-fp8 -OutputDir .\.dev\release-evidence\0.40"
  Write-Host ""
  Write-Host "Runs the Diplomat 0.40 three-hour acceptance workflow and writes acceptance-summary.json under OutputDir."
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
$resolvedOutputDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

Write-Host "Diplomat 0.40 three-hour workflow verification"
Write-Host "  Media: $resolvedMedia"
Write-Host "  ASR model dir: $resolvedAsrModelDir"
Write-Host "  Translation model dir: $resolvedTranslationModelDir"
Write-Host "  Evidence: $resolvedOutputDir"

$argsList = @(
  "scripts\acceptance\run-0-40-three-hour.py",
  "--source-video", $resolvedMedia.Path,
  "--evidence-dir", $resolvedOutputDir,
  "--ffmpeg-path", $FfmpegPath,
  "--ffprobe-path", $FfprobePath,
  "--source-language", $SourceLanguage,
  "--target-language", $TargetLanguage
)

& $PythonExe @argsList
exit $LASTEXITCODE
