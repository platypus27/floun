param(
  [string] $QaEvidencePath
)

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

if (-not $QaEvidencePath) {
  $RepoRoot = Split-Path -Parent $ProjectRoot
  $QaEvidencePath = Join-Path $RepoRoot "docs\release\$Version\QA_EVIDENCE.md"
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
  "(^|/)src/",
  "(^|/)node_modules/",
  "(^|/)docs/",
  "(^|/)scripts/",
  "crypto-readiness\.html",
  "\.map$",
  "\.tsx?$",
  "\.test\.",
  "package(?:-lock)?\.json$",
  "tsconfig\.json$",
  "vite\.config\."
)

$ForbiddenText = @(
  "0123456789abcdef0123456789abcdef",
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL",
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmbG91biJ9.c2lnbmF0dXJl",
  "flounreleasecandidate20260605",
  "QABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890==",
  "secretRawToken",
  "secret-token-value",
  "REACT_APP_GEMINI_API_KEY="
)

$TextExtensions = @(".css", ".html", ".js", ".json", ".txt")
$GeminiKeyPattern = "AIza[0-9A-Za-z_-]{20,}"
$ExpectedPermissions = @("activeTab", "scripting")
$ExpectedHostPermissions = @(
  "https://api.ssllabs.com/*",
  "https://ssl-checker.io/*"
)
$ExpectedExtensionPagesCsp = "script-src 'self'; object-src 'self';"

function Assert-StringSet {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Label,

    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [string[]] $Actual,

    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [string[]] $Expected
  )

  $Missing = @($Expected | Where-Object { $Actual -notcontains $_ })
  $Unexpected = @($Actual | Where-Object { $Expected -notcontains $_ })

  if ($Missing.Length -gt 0 -or $Unexpected.Length -gt 0 -or $Actual.Length -ne $Expected.Length) {
    throw "$Label mismatch. Missing: $($Missing -join ', '); unexpected: $($Unexpected -join ', ')"
  }
}

function Read-ZipEntryText {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.Compression.ZipArchiveEntry] $Entry
  )

  $Reader = [System.IO.StreamReader]::new($Entry.Open())
  try {
    $Reader.ReadToEnd()
  } finally {
    $Reader.Dispose()
  }
}

function Convert-ToZipEntryPath {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Reference
  )

  $Path = ($Reference -replace "[?#].*$", "").Trim()

  if ($Path -match "^(?:https?|data|chrome|mailto):") {
    throw "Release artifact contains forbidden external or data reference: $Reference"
  }

  $Path = $Path.TrimStart("/")

  while ($Path.StartsWith("./")) {
    $Path = $Path.Substring(2)
  }

  if ($Path.StartsWith("../")) {
    throw "Release artifact contains unsupported parent-relative reference: $Reference"
  }

  return $Path
}

function Assert-ZipEntryExists {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Label,

    [Parameter(Mandatory = $true)]
    [string] $Reference,

    [Parameter(Mandatory = $true)]
    [string[]] $NormalizedEntries
  )

  $EntryName = Convert-ToZipEntryPath -Reference $Reference

  if ($EntryName -and $NormalizedEntries -notcontains $EntryName) {
    throw "$Label references missing release artifact entry: $Reference"
  }
}

function Assert-PackagedIndexReferences {
  param(
    [Parameter(Mandatory = $true)]
    [string] $IndexHtml,

    [Parameter(Mandatory = $true)]
    [string[]] $NormalizedEntries
  )

  $References = [regex]::Matches($IndexHtml, '(?:src|href)=["''](?<path>[^"'']+)["'']')

  foreach ($Reference in $References) {
    Assert-ZipEntryExists `
      -Label "Packaged index.html" `
      -Reference $Reference.Groups["path"].Value `
      -NormalizedEntries $NormalizedEntries
  }
}

function Assert-PackagedIndexHasNoInlineExecution {
  param(
    [Parameter(Mandatory = $true)]
    [string] $IndexHtml
  )

  if ($IndexHtml -match '(?is)<script\b(?![^>]*\bsrc\s*=)[^>]*>') {
    throw "Packaged index.html must not contain inline scripts."
  }

  if ($IndexHtml -match '(?i)\s+on[a-z]+\s*=') {
    throw "Packaged index.html must not contain inline event handlers."
  }
}

function Assert-PackagedBackgroundReferences {
  param(
    [Parameter(Mandatory = $true)]
    [string] $BackgroundJs,

    [Parameter(Mandatory = $true)]
    [string[]] $NormalizedEntries
  )

  $References = [regex]::Matches($BackgroundJs, '["''](?<path>\./assets/[^"'']+)["'']')

  foreach ($Reference in $References) {
    Assert-ZipEntryExists `
      -Label "Packaged background.js" `
      -Reference $Reference.Groups["path"].Value `
      -NormalizedEntries $NormalizedEntries
  }
}

function Assert-PackagedManifestReferences {
  param(
    [Parameter(Mandatory = $true)]
    $Manifest,

    [Parameter(Mandatory = $true)]
    [string[]] $NormalizedEntries
  )

  Assert-ZipEntryExists `
    -Label "Packaged manifest default_popup" `
    -Reference $Manifest.action.default_popup `
    -NormalizedEntries $NormalizedEntries
  Assert-ZipEntryExists `
    -Label "Packaged manifest background service_worker" `
    -Reference $Manifest.background.service_worker `
    -NormalizedEntries $NormalizedEntries

  foreach ($IconPath in @($Manifest.icons.PSObject.Properties.Value)) {
    Assert-ZipEntryExists `
      -Label "Packaged manifest icons" `
      -Reference $IconPath `
      -NormalizedEntries $NormalizedEntries
  }

  foreach ($IconPath in @($Manifest.action.default_icon.PSObject.Properties.Value)) {
    Assert-ZipEntryExists `
      -Label "Packaged manifest action default_icon" `
      -Reference $IconPath `
      -NormalizedEntries $NormalizedEntries
  }
}

function Assert-ContentContains {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Content,

    [Parameter(Mandatory = $true)]
    [string] $Label,

    [Parameter(Mandatory = $true)]
    [string] $Expected
  )

  if (-not $Content.Contains($Expected)) {
    throw "QA evidence mismatch: missing $Label ($Expected)"
  }
}

function Assert-QaEvidenceMatchesArtifact {
  param(
    [Parameter(Mandatory = $true)]
    [string] $EvidencePath,

    [Parameter(Mandatory = $true)]
    $Canonical,

    [Parameter(Mandatory = $true)]
    $Alias,

    [Parameter(Mandatory = $true)]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [string] $AliasVersion
  )

  if (-not (Test-Path -LiteralPath $EvidencePath)) {
    throw "QA evidence document is missing: $EvidencePath"
  }

  $Content = Get-Content -Raw -LiteralPath $EvidencePath
  $CanonicalPackagePath = "floun/release/floun-$Version.zip"
  $AliasPackagePath = "floun/release/floun-$AliasVersion.zip"

  Assert-ContentContains -Content $Content -Label "canonical package path" -Expected ('- Package path: `' + $CanonicalPackagePath + '`')
  Assert-ContentContains -Content $Content -Label "alias package path" -Expected ('- Alias package path: `' + $AliasPackagePath + '`')
  Assert-ContentContains -Content $Content -Label "canonical SHA-256" -Expected ('- SHA-256: `' + $Canonical.Hash + '`')
  Assert-ContentContains -Content $Content -Label "alias SHA-256" -Expected ('- Alias SHA-256: `' + $Alias.Hash + '`')
  Assert-ContentContains -Content $Content -Label "artifact size" -Expected ('- Size bytes: `' + $Canonical.Size + '`')
  Assert-ContentContains -Content $Content -Label "deterministic packaging SHA-256" -Expected ('produced matching SHA-256: `' + $Canonical.Hash + '`')

  $EntrySection = [regex]::Match(
    $Content,
    'Required archive entries:\s*(?<entries>(?:\r?\n- `[^`]+`)+)',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )

  if (-not $EntrySection.Success) {
    throw "QA evidence mismatch: required archive entries section is missing or malformed."
  }

  $EvidenceEntries = @(
    [regex]::Matches($EntrySection.Groups["entries"].Value, '- `(?<entry>[^`]+)`') |
      ForEach-Object { $_.Groups["entry"].Value }
  )

  Assert-StringSet -Label "QA evidence archive entries" -Actual $EvidenceEntries -Expected $Canonical.Entries
}

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

    $ManifestEntry = $Zip.Entries | Where-Object { $_.FullName.Replace("\", "/") -eq "manifest.json" } | Select-Object -First 1
    $Manifest = Read-ZipEntryText -Entry $ManifestEntry | ConvertFrom-Json

    if ($Manifest.manifest_version -ne 3) {
      throw "Packaged manifest must use manifest_version 3."
    }

    if ($Manifest.version -ne $Version) {
      throw "Packaged manifest version $($Manifest.version) does not match package version $Version."
    }

    Assert-StringSet -Label "Packaged manifest permissions" -Actual @($Manifest.permissions) -Expected $ExpectedPermissions
    Assert-StringSet -Label "Packaged manifest host_permissions" -Actual @($Manifest.host_permissions) -Expected $ExpectedHostPermissions

    if ($null -ne $Manifest.content_scripts) {
      throw "Packaged manifest must not include always-on content_scripts."
    }

    if ($Manifest.background.service_worker -ne "background.js") {
      throw "Packaged manifest background service worker must be background.js."
    }

    if ($Manifest.background.type -ne "module") {
      throw "Packaged manifest background worker must be a module."
    }

    if ($Manifest.content_security_policy.extension_pages -ne $ExpectedExtensionPagesCsp) {
      throw "Packaged manifest extension_pages CSP must be $ExpectedExtensionPagesCsp."
    }

    Assert-PackagedManifestReferences -Manifest $Manifest -NormalizedEntries $NormalizedEntries

    $IndexEntry = $Zip.Entries | Where-Object { $_.FullName.Replace("\", "/") -eq "index.html" } | Select-Object -First 1
    $IndexHtml = Read-ZipEntryText -Entry $IndexEntry
    Assert-PackagedIndexHasNoInlineExecution -IndexHtml $IndexHtml
    Assert-PackagedIndexReferences -IndexHtml $IndexHtml -NormalizedEntries $NormalizedEntries

    $BackgroundEntry = $Zip.Entries | Where-Object { $_.FullName.Replace("\", "/") -eq "background.js" } | Select-Object -First 1
    $BackgroundJs = Read-ZipEntryText -Entry $BackgroundEntry
    Assert-PackagedBackgroundReferences -BackgroundJs $BackgroundJs -NormalizedEntries $NormalizedEntries

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

      if ($Content -match '(?im)(?://[#@]\s*sourceMappingURL\s*=|/\*[#@]\s*sourceMappingURL\s*=)') {
        throw "Release artifact contains forbidden source map reference in $EntryName"
      }

      if ($Extension -eq ".css" -and $Content -match '(?i)(?:@import\s+(?:url\()?\s*["'']?\s*(?:(?:https?|data|chrome|mailto):|//)|url\(\s*["'']?\s*(?:(?:https?|data|chrome|mailto):|//))') {
        throw "Release artifact contains forbidden external CSS reference in $EntryName"
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

Assert-QaEvidenceMatchesArtifact `
  -EvidencePath $QaEvidencePath `
  -Canonical $Canonical `
  -Alias $Alias `
  -Version $Version `
  -AliasVersion $AliasVersion

Write-Host "Release artifact verified: $($Canonical.Path)"
Write-Host "Alias artifact verified: $($Alias.Path)"
Write-Host "Size bytes: $($Canonical.Size)"
Write-Host "SHA-256: $($Canonical.Hash)"
Write-Host "Archive entries:"
$Canonical.Entries | ForEach-Object { Write-Host " - $_" }
