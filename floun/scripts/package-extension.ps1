$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackagePath = Join-Path $ProjectRoot "package.json"
$BuildDir = Join-Path $ProjectRoot "build"
$ReleaseDir = Join-Path $ProjectRoot "release"

if (-not (Test-Path -LiteralPath $PackagePath)) {
  throw "package.json was not found at $PackagePath"
}

$Package = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
$Version = $Package.version
$ZipPath = Join-Path $ReleaseDir "floun-$Version.zip"

@("manifest.json", "index.html", "background.js") | ForEach-Object {
  $RequiredPath = Join-Path $BuildDir $_
  if (-not (Test-Path -LiteralPath $RequiredPath)) {
    throw "Required build artifact is missing: $RequiredPath"
  }
}

New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

$BuildContents = Join-Path $BuildDir "*"
Compress-Archive -Path $BuildContents -DestinationPath $ZipPath -Force

Write-Host "Packaged Floun extension: $ZipPath"
