$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $root "logs"
$outLog = Join-Path $logDir "misty-launcher.out.log"
$errLog = Join-Path $logDir "misty-launcher.err.log"
$wakeOutLog = Join-Path $logDir "openwake.out.log"
$wakeErrLog = Join-Path $logDir "openwake.err.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Stop-MistyDevProcesses {
  foreach ($name in @("misty", "cargo", "rustc")) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        Stop-Process -Id $_.Id -Force -ErrorAction Stop
      } catch {
        Add-Content -Path $errLog -Value "Failed to stop $name process $($_.Id): $($_.Exception.Message)"
      }
    }
  }

  Get-Process -Name python -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      if ($_.Path -like "$($root.Path)\local-voice\*") {
        Stop-Process -Id $_.Id -Force -ErrorAction Stop
      }
    } catch {
      Add-Content -Path $errLog -Value "Failed to inspect/stop python process $($_.Id): $($_.Exception.Message)"
    }
  }
}

function Stop-PortOwner {
  param([int]$Port)

  $connections = @()

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    $connections = netstat -ano |
      Select-String "LISTENING" |
      ForEach-Object {
        $parts = ($_ -split "\s+") | Where-Object { $_ }
        if ($parts.Length -ge 5 -and $parts[1] -match ":$Port$") {
          [int]$parts[4]
        }
      } |
      Select-Object -Unique
  }

  foreach ($processId in $connections) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Add-Content -Path $errLog -Value "Failed to stop port $Port owner $($processId): $($_.Exception.Message)"
    }
  }
}

Stop-MistyDevProcesses
Stop-PortOwner -Port 1420
Stop-PortOwner -Port 8765

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

Start-Process `
  -FilePath $npm `
  -ArgumentList @("run", "tauri:dev") `
  -WorkingDirectory $root `
  -WindowStyle Minimized `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

$wakeDir = Join-Path $root "local-voice"
$wakeScript = Join-Path $wakeDir "wakeword-server.py"
$wakePython = Join-Path $wakeDir ".venv\Scripts\python.exe"

if (Test-Path $wakeScript) {
  $python = if (Test-Path $wakePython) { $wakePython } else { (Get-Command python -ErrorAction Stop).Source }

  Start-Process `
    -FilePath $python `
    -ArgumentList @("wakeword-server.py") `
    -WorkingDirectory $wakeDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $wakeOutLog `
    -RedirectStandardError $wakeErrLog
} else {
  Add-Content -Path $wakeErrLog -Value "Missing wakeword server script: $wakeScript"
}
