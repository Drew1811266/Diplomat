$ErrorActionPreference = "Stop"

Write-Host "Running TypeScript checks"
pnpm -r test
pnpm -r typecheck

Write-Host "Running Python tests"
python -m pytest
