$ErrorActionPreference = "Stop"

Write-Host "Installing JavaScript dependencies if needed"
corepack pnpm install --frozen-lockfile

Write-Host "Verifying release version metadata"
node .\scripts\verify-version.mjs

Write-Host "Verifying release packaging assets"
node .\scripts\verify-release-assets.mjs

Write-Host "Running TypeScript package checks"
corepack pnpm -r test
corepack pnpm -r typecheck

Write-Host "Installing Python worker in editable mode"
python -m pip install -e .\worker[dev]

Write-Host "Running Python tests"
python -m pytest

Write-Host "All M0/M1 checks completed"
