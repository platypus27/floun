$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackagePath = Join-Path $ProjectRoot "package.json"
$Package = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
$Version = $Package.version
$ZipPath = Join-Path $ProjectRoot "release\floun-$Version.zip"
$VersionParts = $Version -split "\."
$AliasVersion = if ($VersionParts.Length -ge 2) { "$($VersionParts[0]).$($VersionParts[1])" } else { $Version }
$AliasZipPath = Join-Path $ProjectRoot "release\floun-$AliasVersion.zip"

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

function Test-ReleaseZip {
  param(
    [Parameter(Mandatory = $true)]
    [string] $CandidateZipPath
  )

  if (-not (Test-Path -LiteralPath $CandidateZipPath)) {
    throw "Release artifact is missing: $CandidateZipPath"
  }

  $Zip = [System.IO.Compression.ZipFile]::OpenRead($CandidateZipPath)

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

  $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $CandidateZipPath).Hash.ToLowerInvariant()
  $Size = (Get-Item -LiteralPath $CandidateZipPath).Length

  [PSCustomObject]@{
    Path = $CandidateZipPath
    Hash = $Hash
    Size = $Size
    Entries = @($NormalizedEntries | Sort-Object)
  }
}

$Canonical = Test-ReleaseZip -CandidateZipPath $ZipPath
$Alias = if ($AliasZipPath -ne $ZipPath) {
  Test-ReleaseZip -CandidateZipPath $AliasZipPath
} else {
  $Canonical
}

if ($Alias.Hash -ne $Canonical.Hash) {
  throw "Release alias hash does not match canonical artifact: $($Alias.Path)"
}

Write-Host "Release artifact verified: $($Canonical.Path)"
Write-Host "Alias artifact verified: $($Alias.Path)"
Write-Host "Size bytes: $($Canonical.Size)"
Write-Host "SHA-256: $($Canonical.Hash)"
Write-Host "Archive entries:"
$Canonical.Entries | ForEach-Object { Write-Host " - $_" }
