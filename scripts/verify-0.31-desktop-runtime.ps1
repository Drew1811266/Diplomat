$ErrorActionPreference = "Stop"

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

Write-Host "Verifying release metadata"
Invoke-Native node @(".\scripts\verify-release-assets.mjs")

Write-Host "Preparing desktop runtime"
.\scripts\prepare-desktop-runtime.ps1

Write-Host "Building web app"
Invoke-Native corepack @("pnpm", "--dir", "apps/web", "build")

Write-Host "Building desktop installer"
Invoke-Native corepack @("pnpm", "--dir", "apps/desktop", "build")

$installer = Get-ChildItem .\apps\desktop\src-tauri\target\release\bundle\nsis\*0.31*.exe -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -eq $installer) {
  throw "No NSIS installer was produced."
}

Write-Host "Produced installer: $($installer.FullName)"
