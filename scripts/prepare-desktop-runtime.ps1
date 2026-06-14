$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DesktopRoot = Join-Path $Root "apps\desktop\src-tauri"
$BinariesDir = Join-Path $DesktopRoot "binaries"
$ResourcesDir = Join-Path $DesktopRoot "resources"
$PyInstallerWork = Join-Path $Root ".tmp\pyinstaller\build"
$PyInstallerSpec = Join-Path $Root ".tmp\pyinstaller\spec"

function Resolve-ToolPath {
  param(
    [Parameter(Mandatory = $true)][string]$EnvName,
    [Parameter(Mandatory = $true)][string]$FallbackRelativePath,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $configured = [Environment]::GetEnvironmentVariable($EnvName)
  if ($configured -and (Test-Path $configured)) {
    return (Resolve-Path $configured).Path
  }

  $fallback = Join-Path $Root $FallbackRelativePath
  if (Test-Path $fallback) {
    return (Resolve-Path $fallback).Path
  }

  throw "$Label was not found. Set $EnvName or install the release FFmpeg bundle under .dev\tools."
}

New-Item -ItemType Directory -Force -Path $BinariesDir, $ResourcesDir, $PyInstallerWork, $PyInstallerSpec | Out-Null

$ffmpeg = Resolve-ToolPath `
  -EnvName "DIPLOMAT_FFMPEG_PATH" `
  -FallbackRelativePath ".dev\tools\ffmpeg-release-essentials\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe" `
  -Label "FFmpeg"
$ffprobe = Resolve-ToolPath `
  -EnvName "DIPLOMAT_FFPROBE_PATH" `
  -FallbackRelativePath ".dev\tools\ffmpeg-release-essentials\ffmpeg-8.1.1-essentials_build\bin\ffprobe.exe" `
  -Label "FFprobe"

Copy-Item -LiteralPath $ffmpeg -Destination (Join-Path $ResourcesDir "ffmpeg.exe") -Force
Copy-Item -LiteralPath $ffprobe -Destination (Join-Path $ResourcesDir "ffprobe.exe") -Force

python -m PyInstaller `
  --clean `
  --onefile `
  --name diplomat-worker `
  --paths (Join-Path $Root "worker") `
  --distpath $BinariesDir `
  --workpath $PyInstallerWork `
  --specpath $PyInstallerSpec `
  (Join-Path $Root "scripts\diplomat_worker_sidecar.py")

$workerExe = Join-Path $BinariesDir "diplomat-worker.exe"
if (-not (Test-Path $workerExe)) {
  throw "PyInstaller did not produce $workerExe"
}

$tauriWindowsSidecar = Join-Path $BinariesDir "diplomat-worker-x86_64-pc-windows-msvc.exe"
Copy-Item -LiteralPath $workerExe -Destination $tauriWindowsSidecar -Force

Write-Host "Prepared desktop runtime:"
Write-Host "  Worker: $workerExe"
Write-Host "  Tauri sidecar: $tauriWindowsSidecar"
Write-Host "  FFmpeg: $(Join-Path $ResourcesDir "ffmpeg.exe")"
Write-Host "  FFprobe: $(Join-Path $ResourcesDir "ffprobe.exe")"
