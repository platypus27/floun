$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackageScript = Join-Path $PSScriptRoot "package-extension.ps1"
$ArtifactScript = Join-Path $PSScriptRoot "check-release-artifact.ps1"
$PackagePath = Join-Path $ProjectRoot "package.json"

if (-not (Test-Path -LiteralPath $PackagePath)) {
  throw "package.json was not found at $PackagePath"
}

$Package = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
$Version = $Package.version
$ZipPath = Join-Path $ProjectRoot "release\floun-$Version.zip"

function Invoke-PackageAndValidate {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $PackageScript | Write-Host
  & powershell -NoProfile -ExecutionPolicy Bypass -File $ArtifactScript | Write-Host

  if (-not (Test-Path -LiteralPath $ZipPath)) {
    throw "Release artifact is missing after packaging: $ZipPath"
  }

  return (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipPath).Hash.ToLowerInvariant()
}

$FirstHash = Invoke-PackageAndValidate
$SecondHash = Invoke-PackageAndValidate

if ($FirstHash -ne $SecondHash) {
  throw "Release package is not deterministic. First SHA-256: $FirstHash; second SHA-256: $SecondHash"
}

Write-Host "Release package determinism verified."
Write-Host "SHA-256: $FirstHash"
