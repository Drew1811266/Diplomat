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

Write-Host "Installing JavaScript dependencies if needed"
Invoke-Native corepack @("pnpm", "install", "--frozen-lockfile")

Write-Host "Verifying release version metadata"
Invoke-Native node @(".\scripts\verify-version.mjs")

Write-Host "Verifying release packaging assets"
Invoke-Native node @(".\scripts\verify-release-assets.mjs")

Write-Host "Running TypeScript package checks"
Invoke-Native corepack @("pnpm", "-r", "test")
Invoke-Native corepack @("pnpm", "-r", "typecheck")

Write-Host "Installing Python worker in editable mode"
Invoke-Native python @("-m", "pip", "install", "-e", ".\worker[dev]")

Write-Host "Running Python tests"
Invoke-Native python @("-m", "pytest")

Write-Host "All M0/M1 checks completed"
