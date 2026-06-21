$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeLauncher = Join-Path $ScriptDir "start-dev-desktop.mjs"

& node $NodeLauncher @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
