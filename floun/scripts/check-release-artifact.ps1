$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackagePath = Join-Path $ProjectRoot "package.json"
$Package = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
$Version = $Package.version
$ZipPath = Join-Path $ProjectRoot "release\floun-$Version.zip"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "Release artifact is missing: $ZipPath"
}

$RequiredEntries = @(
  "manifest.json",
  "index.html",
  "background.js",
  "icons/icon_16.png",
  "icons/icon_48.png",
  "icons/icon_128.png"
)

$RequiredPrefixes = @(
  "assets/",
  "icons/"
)

$ForbiddenEntryPatterns = @(
  "(^|/)\.env($|[./])",
  "(^|/)fixtures?/",
  "crypto-readiness\.html"
)

$ForbiddenText = @(
  "0123456789abcdef0123456789abcdef",
  "flounreleasecandidate20260605",
  "secretRawToken",
  "REACT_APP_GEMINI_API_KEY="
)

$TextExtensions = @(".css", ".html", ".js", ".json", ".txt")
$GeminiKeyPattern = "AIza[0-9A-Za-z_-]{20,}"
$Zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

try {
  $NormalizedEntries = @($Zip.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })

  foreach ($RequiredEntry in $RequiredEntries) {
    if ($NormalizedEntries -notcontains $RequiredEntry) {
      throw "Release artifact is missing required entry: $RequiredEntry"
    }
  }

  foreach ($RequiredPrefix in $RequiredPrefixes) {
    if (-not ($NormalizedEntries | Where-Object { $_.StartsWith($RequiredPrefix) })) {
      throw "Release artifact is missing required directory: $RequiredPrefix"
    }
  }

  foreach ($EntryName in $NormalizedEntries) {
    foreach ($Pattern in $ForbiddenEntryPatterns) {
      if ($EntryName -match $Pattern) {
        throw "Release artifact contains forbidden entry: $EntryName"
      }
    }
  }

  foreach ($Entry in $Zip.Entries) {
    $EntryName = $Entry.FullName.Replace("\", "/")
    $Extension = [System.IO.Path]::GetExtension($EntryName).ToLowerInvariant()

    if ($TextExtensions -notcontains $Extension) {
      continue
    }

    $Reader = [System.IO.StreamReader]::new($Entry.Open())
    try {
      $Content = $Reader.ReadToEnd()
    } finally {
      $Reader.Dispose()
    }

    foreach ($ForbiddenValue in $ForbiddenText) {
      if ($Content.Contains($ForbiddenValue)) {
        throw "Release artifact contains forbidden fixture or secret marker in $EntryName"
      }
    }

    if ($Content -match $GeminiKeyPattern) {
      throw "Release artifact contains a Gemini API-key-like value in $EntryName"
    }
  }
} finally {
  $Zip.Dispose()
}

$Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipPath).Hash.ToLowerInvariant()
$Size = (Get-Item -LiteralPath $ZipPath).Length

Write-Host "Release artifact verified: $ZipPath"
Write-Host "Size bytes: $Size"
Write-Host "SHA-256: $Hash"
Write-Host "Archive entries:"
$NormalizedEntries | Sort-Object | ForEach-Object { Write-Host " - $_" }
