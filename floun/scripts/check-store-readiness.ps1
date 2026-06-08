$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ProjectRoot
$PackagePath = Join-Path $ProjectRoot "package.json"
$Package = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
$StoreDocsRoot = Join-Path $RepoRoot "docs\store"
$ReleaseDocsRoot = Join-Path $RepoRoot "docs\release\$($Package.version)"
$StoreAssetsRoot = Join-Path $StoreDocsRoot "assets"

$RequiredDocs = @(
  (Join-Path $ReleaseDocsRoot "QA_EVIDENCE.md"),
  (Join-Path $StoreDocsRoot "CHROME_WEB_STORE_LISTING.md"),
  (Join-Path $StoreDocsRoot "CHROME_WEB_STORE_PRIVACY.md"),
  (Join-Path $StoreDocsRoot "PRIVACY_POLICY.md")
)

foreach ($DocPath in $RequiredDocs) {
  if (-not (Test-Path -LiteralPath $DocPath)) {
    throw "Store readiness document is missing: $DocPath"
  }

  if ((Get-Item -LiteralPath $DocPath).Length -le 0) {
    throw "Store readiness document is empty: $DocPath"
  }
}

$Assets = @(
  [pscustomobject]@{
    Label = "extension icon"
    Path = Join-Path $ProjectRoot "public\icons\icon_128.png"
    Width = 128
    Height = 128
  },
  [pscustomobject]@{
    Label = "store screenshot"
    Path = Join-Path $StoreAssetsRoot "floun-store-screenshot-1280x800.png"
    Width = 1280
    Height = 800
  },
  [pscustomobject]@{
    Label = "small promotional image"
    Path = Join-Path $StoreAssetsRoot "floun-small-promo-440x280.png"
    Width = 440
    Height = 280
  }
)

foreach ($Asset in $Assets) {
  if (-not (Test-Path -LiteralPath $Asset.Path)) {
    throw "Required $($Asset.Label) asset is missing: $($Asset.Path)"
  }

  $Image = [System.Drawing.Image]::FromFile($Asset.Path)
  try {
    if ($Image.Width -ne $Asset.Width -or $Image.Height -ne $Asset.Height) {
      throw "$($Asset.Label) must be $($Asset.Width)x$($Asset.Height), found $($Image.Width)x$($Image.Height): $($Asset.Path)"
    }
  } finally {
    $Image.Dispose()
  }
}

Write-Host "Chrome Web Store readiness verified."
Write-Host "Documents:"
$RequiredDocs | ForEach-Object { Write-Host " - $_" }
Write-Host "Assets:"
$Assets | ForEach-Object { Write-Host " - $($_.Label): $($_.Path) ($($_.Width)x$($_.Height))" }
