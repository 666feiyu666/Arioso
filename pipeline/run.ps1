$ErrorActionPreference = 'Stop'
$pythonCommand = Get-Command python -CommandType Application -ErrorAction Stop | Select-Object -First 1
& $pythonCommand.Source (Join-Path $PSScriptRoot 'run.py') @args
exit $LASTEXITCODE
