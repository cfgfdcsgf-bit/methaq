param([switch]$Migrate)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
function Invoke-QACommand([string]$Label, [string]$Command, [string[]]$Arguments) {
  Write-Host "== Meethaq QA: $Label ==" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "QA stopped: '$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
  }
}

Invoke-QACommand 'typecheck' 'pnpm' @('check')
Invoke-QACommand 'tests' 'pnpm' @('test')
Invoke-QACommand 'production build' 'pnpm' @('build')
Invoke-QACommand 'static integrity' 'node' @('scripts/verify-project.mjs', '--build')
if ($Migrate) {
  Invoke-QACommand 'database migrations' 'pnpm' @('db:migrate')
}
Write-Host 'QA completed successfully.' -ForegroundColor Green
