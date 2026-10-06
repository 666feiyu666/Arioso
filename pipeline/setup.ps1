[CmdletBinding()]
param([string]$RuntimeDir, [string]$FfmpegPath)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $RuntimeDir) { $RuntimeDir = Join-Path $PSScriptRoot 'runtime' }
elseif (-not [System.IO.Path]::IsPathRooted($RuntimeDir)) { $RuntimeDir = Join-Path $projectRoot $RuntimeDir }
$runtimeRoot = [System.IO.Path]::GetFullPath($RuntimeDir)
if ($FfmpegPath) {
    $FfmpegPath = (Get-Item -LiteralPath $FfmpegPath -ErrorAction Stop).FullName
    if (-not (Test-Path -LiteralPath $FfmpegPath -PathType Leaf)) { throw 'FfmpegPath must name a file.' }
}
if ($runtimeRoot.TrimEnd('\','/') -eq $projectRoot.TrimEnd('\','/')) {
    throw 'RuntimeDir must be a dedicated runtime directory, not the project root.'
}

$historicalCommit = '114fce7c849c5c5ed9c1c69bdb1610a5b949796b'
$checkpointHash = '964CDA73631A60CA09DEF2640F71B48E97F3E3FEE9A6BCAF4827DC1F91030AC9'
$historicalRoot = Join-Path $runtimeRoot 'historical'
$repository = Join-Path $historicalRoot 'repository'
$venvFolder = Join-Path $historicalRoot '.venv'
$pythonExe = Join-Path $venvFolder 'Scripts\python.exe'
$pythonInstallRoot = Join-Path $runtimeRoot 'python'
$assetFolder = Join-Path $runtimeRoot 'assets'
$binFolder = Join-Path $runtimeRoot 'bin'
$checkpointArchive = Join-Path $assetFolder 'historical-checkpoint.zip'
$weightsFolder = Join-Path $repository 'experiments\trained_model'
$cacheFolder = Join-Path $runtimeRoot 'cache'
$uvCommand = Get-Command uv -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $uvCommand) { throw 'uv was not found. Install it from https://docs.astral.sh/uv/getting-started/installation/ and rerun setup.' }
$gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $gitCommand) { throw 'git was not found. Install Git and rerun setup.' }

function Invoke-CheckedNative {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $($LASTEXITCODE): $Executable $($Arguments -join ' ')"
    }
}

$originalLocation = Get-Location
$originalEnvironment = @{
    UV_PYTHON_INSTALL_DIR = [Environment]::GetEnvironmentVariable('UV_PYTHON_INSTALL_DIR', 'Process')
    UV_CACHE_DIR = [Environment]::GetEnvironmentVariable('UV_CACHE_DIR', 'Process')
}
try {
    New-Item -ItemType Directory -Force -Path $runtimeRoot,$historicalRoot,$pythonInstallRoot,$assetFolder,$binFolder,$cacheFolder | Out-Null
    Set-Location -LiteralPath $runtimeRoot
    $env:UV_PYTHON_INSTALL_DIR = $pythonInstallRoot
    $env:UV_CACHE_DIR = $cacheFolder

    # Fetch and pin only a new checkout; preserve all existing source changes.
    $isNewCheckout = -not (Test-Path -LiteralPath (Join-Path $repository '.git'))
    if ($isNewCheckout) {
        if ((Test-Path -LiteralPath $repository) -and @(Get-ChildItem -LiteralPath $repository -Force).Count) {
            throw "Existing repository directory is not a Git checkout: $repository"
        }
        Invoke-CheckedNative $gitCommand.Source @('clone','--no-checkout','--depth','1','https://github.com/eloimoliner/denoising-historical-recordings.git',$repository)
        Invoke-CheckedNative $gitCommand.Source @('-C',$repository,'fetch','--depth','1','origin',$historicalCommit)
        Invoke-CheckedNative $gitCommand.Source @('-C',$repository,'checkout','--detach',$historicalCommit)
    }
    $actualCommit = (& $gitCommand.Source -C $repository rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $actualCommit.Trim() -ne $historicalCommit) {
        throw "Historical checkout has a different commit and was left unchanged. Choose another RuntimeDir: $repository"
    }
    $trackedChanges = @(& $gitCommand.Source -C $repository status --porcelain=1 --untracked-files=no)
    if ($LASTEXITCODE -ne 0 -or $trackedChanges.Count) { throw "Historical source has local changes and was left unchanged: $repository" }
    $untrackedFiles = @(& $gitCommand.Source -C $repository ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw "Cannot inspect historical source: $repository" }
    $unexpectedFiles = @($untrackedFiles | Where-Object {
        $_ -notmatch '(^|/)__pycache__/[^/]+\.pyc$' -and
        $_ -notmatch '^outputs/' -and
        $_ -notmatch '^experiments/trained_model/checkpoint(\.index|\.data-00000-of-00001)?$'
    })
    if ($unexpectedFiles.Count) { throw "Historical source contains untracked files; nothing was overwritten: $($unexpectedFiles -join ', ')" }

    # Create the venv at its final path instead of copying or moving an old venv.
    Invoke-CheckedNative $uvCommand.Source @('python','install','3.8.20','--no-bin','--no-registry')
    $managedPython = (& $uvCommand.Source python find --managed-python 3.8.20)
    if ($LASTEXITCODE -ne 0 -or -not $managedPython) { throw 'Cannot locate local managed Python 3.8.20.' }
    $managedPython = [System.IO.Path]::GetFullPath($managedPython.Trim())
    $managedPrefix = $pythonInstallRoot.TrimEnd('\','/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $managedPython.StartsWith($managedPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw "Python resolved outside this runtime: $managedPython" }
    if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) {
        if (Test-Path -LiteralPath $venvFolder) { throw "Existing venv is incomplete and was left unchanged. Choose another RuntimeDir: $venvFolder" }
        Invoke-CheckedNative $uvCommand.Source @('venv','--python',$managedPython,$venvFolder)
    }
    $environmentCheck = 'import json,sys; print(json.dumps({"version":sys.version.split()[0],"base_prefix":sys.base_prefix}))'
    $environmentInfo = (& $pythonExe -c $environmentCheck) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $environmentInfo.version -ne '3.8.20' -or
        -not ([System.IO.Path]::GetFullPath($environmentInfo.base_prefix) + [System.IO.Path]::DirectorySeparatorChar).StartsWith($managedPrefix,[StringComparison]::OrdinalIgnoreCase)) {
        throw "Existing venv uses a different Python runtime and was left unchanged: $venvFolder"
    }
    Invoke-CheckedNative $uvCommand.Source @('pip','install','--python',$pythonExe,'--cache-dir',$cacheFolder,'-r',(Join-Path $repository 'requirements.txt'))

    # Reuse complete weights; download and verify the archive only for extraction.
    $checkpointFiles = @('checkpoint','checkpoint.index','checkpoint.data-00000-of-00001')
    $missingWeights = @($checkpointFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $weightsFolder $_) -PathType Leaf) })
    if ($missingWeights.Count) {
        if (@($checkpointFiles | Where-Object { Test-Path -LiteralPath (Join-Path $weightsFolder $_) }).Count) { throw "Existing checkpoint is incomplete; nothing was overwritten: $weightsFolder" }
        if (-not (Test-Path -LiteralPath $checkpointArchive -PathType Leaf)) {
            Invoke-WebRequest -Uri 'https://github.com/eloimoliner/denoising-historical-recordings/releases/download/v0.0/checkpoint.zip' -OutFile $checkpointArchive -UseBasicParsing
        }
        if ((Get-FileHash -LiteralPath $checkpointArchive -Algorithm SHA256).Hash -ne $checkpointHash) { throw "Checkpoint failed SHA256 and was left in place: $checkpointArchive" }
        New-Item -ItemType Directory -Force -Path $weightsFolder | Out-Null
        Expand-Archive -LiteralPath $checkpointArchive -DestinationPath $weightsFolder
    }

    $ffmpegDestination = Join-Path $binFolder 'ffmpeg.exe'
    if ($FfmpegPath) { $ffmpegSource = (Get-Item -LiteralPath $FfmpegPath -ErrorAction Stop).FullName }
    else {
        if (Test-Path -LiteralPath $ffmpegDestination -PathType Leaf) { $ffmpegSource = $ffmpegDestination }
        else {
            $ffmpegCommand = Get-Command ffmpeg -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            $ffmpegSource = if ($ffmpegCommand) { $ffmpegCommand.Source } else { $null }
        }
    }
    if (-not $ffmpegSource) { throw 'FFmpeg was not found. Download a Windows build linked from https://ffmpeg.org/download.html and pass -FfmpegPath path\to\ffmpeg.exe.' }
    if ($ffmpegSource -ne $ffmpegDestination -and (-not (Test-Path -LiteralPath $ffmpegDestination) -or $FfmpegPath)) { Copy-Item -LiteralPath $ffmpegSource -Destination $ffmpegDestination -Force }
    Invoke-CheckedNative $ffmpegDestination @('-hide_banner','-version')

    $versionsCheck = @'
import json,sys,importlib.metadata as m
expected={"tensorflow":"2.3.0","numpy":"1.18.5","scipy":"1.4.1","hydra-core":"0.11.3","SoundFile":"0.10.3.post1"}
actual={name:m.version(name) for name in expected}
if actual != expected:
    raise RuntimeError("Historical package version mismatch: " + repr(actual))
print(json.dumps({"python":sys.version.split()[0],"packages":actual}))
'@
    Invoke-CheckedNative $pythonExe @('-c',$versionsCheck)
    $runtimeConfig = [ordered]@{
        ffmpeg = $ffmpegDestination
        historical_python = $pythonExe
        historical_repository = $repository
        historical_commit = $historicalCommit
        checkpoint_sha256 = $checkpointHash
    }
    $configPath = Join-Path $runtimeRoot 'runtime.json'
    $json = $runtimeConfig | ConvertTo-Json -Depth 3
    [System.IO.File]::WriteAllText($configPath,$json + [Environment]::NewLine,[System.Text.UTF8Encoding]::new($false))
    Write-Host "Pipeline runtime ready: $configPath"
} finally {
    foreach ($name in $originalEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name,$originalEnvironment[$name],'Process') }
    Set-Location -LiteralPath $originalLocation.Path
}
