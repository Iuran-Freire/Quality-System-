$ErrorActionPreference = "Stop"

$projectDirectory = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectDirectory "backend\.env"
$backupDirectory = Join-Path $projectDirectory "backups"

if (-not (Test-Path -LiteralPath $environmentFile)) {
  Write-Warning "Backup ignorado: arquivo backend\.env não encontrado."
  exit 0
}

$settings = @{}
Get-Content -LiteralPath $environmentFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
    $name, $value = $line.Split("=", 2)
    $settings[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
  }
}

$pgDumpCommand = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDumpCommand) {
  $pgDumpCommand = Get-ChildItem `
    -Path "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" `
    -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

  if (-not $pgDumpCommand) {
    Write-Warning "Backup ignorado: pg_dump não foi encontrado."
    exit 0
  }
}

$databaseName = $settings["DB_NAME"]
if (-not $databaseName) {
  Write-Warning "Backup ignorado: DB_NAME não está configurado."
  exit 0
}

$databaseHost = if ($settings["DB_HOST"]) { $settings["DB_HOST"] } else { "localhost" }
$databasePort = if ($settings["DB_PORT"]) { $settings["DB_PORT"] } else { "5432" }

New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $backupDirectory "quality_system_$timestamp.dump"
$env:PGPASSWORD = $settings["DB_PASSWORD"]

try {
  & $pgDumpCommand `
    --host $databaseHost `
    --port $databasePort `
    --username $settings["DB_USER"] `
    --format custom `
    --file $backupFile `
    $databaseName

  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump finalizou com código $LASTEXITCODE."
  }

  Write-Host "Backup criado: $backupFile"
} catch {
  if (Test-Path -LiteralPath $backupFile) {
    Remove-Item -LiteralPath $backupFile -Force
  }
  Write-Warning "Não foi possível criar o backup: $($_.Exception.Message)"
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
