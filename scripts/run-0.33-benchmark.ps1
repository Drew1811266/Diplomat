param(
  [Parameter(Mandatory = $true)][string]$MediaPath,
  [string]$OutputDir = ".dev\benchmarks",
  [string]$Task = "asr",
  [string]$Provider = "faster-whisper",
  [string]$ModelId = "asr.faster-whisper.small",
  [string]$Device = "cpu",
  [string]$ComputeType = "int8",
  [int]$BatchSize = 1,
  [int]$DurationMs = 0
)

$ErrorActionPreference = "Stop"

python -m diplomat_worker.benchmarks `
  --media "$MediaPath" `
  --output "$OutputDir" `
  --task "$Task" `
  --provider "$Provider" `
  --model-id "$ModelId" `
  --device "$Device" `
  --compute-type "$ComputeType" `
  --batch-size "$BatchSize" `
  --duration-ms "$DurationMs"
