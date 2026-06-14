$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DesktopRoot = Join-Path $Root "apps\desktop\src-tauri"
$BinariesDir = Join-Path $DesktopRoot "binaries"
$ResourcesDir = Join-Path $DesktopRoot "resources"
$PyInstallerWork = Join-Path $Root ".tmp\pyinstaller\build"
$PyInstallerSpec = Join-Path $Root ".tmp\pyinstaller\spec"
$WorkerExe = Join-Path $BinariesDir "diplomat-worker.exe"
$TauriWindowsSidecar = Join-Path $BinariesDir "diplomat-worker-x86_64-pc-windows-msvc.exe"

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

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

function Stop-GeneratedWorkerProcesses {
  $targetPaths = @($WorkerExe, $TauriWindowsSidecar)
  $processes = Get-CimInstance Win32_Process |
    Where-Object { $_.ExecutablePath -and ($targetPaths -contains $_.ExecutablePath) }

  foreach ($process in $processes) {
    Write-Host "Stopping stale worker process $($process.ProcessId): $($process.ExecutablePath)"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
  }
}

New-Item -ItemType Directory -Force -Path $BinariesDir, $ResourcesDir, $PyInstallerWork, $PyInstallerSpec | Out-Null
Stop-GeneratedWorkerProcesses

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

$pyInstallerArgs = @(
  "-m",
  "PyInstaller",
  "--clean",
  "--onefile",
  "--name",
  "diplomat-worker",
  "--paths",
  (Join-Path $Root "worker"),
  "--distpath",
  $BinariesDir,
  "--workpath",
  $PyInstallerWork,
  "--specpath",
  $PyInstallerSpec,
  (Join-Path $Root "scripts\diplomat_worker_sidecar.py")
)
Invoke-Native python $pyInstallerArgs

if (-not (Test-Path $WorkerExe)) {
  throw "PyInstaller did not produce $WorkerExe"
}

Copy-Item -LiteralPath $WorkerExe -Destination $TauriWindowsSidecar -Force

Write-Host "Prepared desktop runtime:"
Write-Host "  Worker: $WorkerExe"
Write-Host "  Tauri sidecar: $TauriWindowsSidecar"
Write-Host "  FFmpeg: $(Join-Path $ResourcesDir "ffmpeg.exe")"
Write-Host "  FFprobe: $(Join-Path $ResourcesDir "ffprobe.exe")"
