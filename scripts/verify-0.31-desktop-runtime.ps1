$ErrorActionPreference = "Stop"

Write-Host "Verifying release metadata"
node .\scripts\verify-release-assets.mjs

Write-Host "Preparing desktop runtime"
.\scripts\prepare-desktop-runtime.ps1

Write-Host "Building web app"
corepack pnpm --dir apps/web build

Write-Host "Building desktop installer"
corepack pnpm --dir apps/desktop build

$installer = Get-ChildItem .\apps\desktop\src-tauri\target\release\bundle\nsis\*0.31*.exe -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -eq $installer) {
  throw "No NSIS installer was produced."
}

Write-Host "Produced installer: $($installer.FullName)"
