$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

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
$VersionParts = $Version -split "\."
$AliasVersion = if ($VersionParts.Length -ge 2) { "$($VersionParts[0]).$($VersionParts[1])" } else { $Version }
$AliasZipPath = Join-Path $ReleaseDir "floun-$AliasVersion.zip"

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

if ($AliasZipPath -ne $ZipPath -and (Test-Path -LiteralPath $AliasZipPath)) {
  Remove-Item -LiteralPath $AliasZipPath -Force
}

function New-DeterministicZip {
  param(
    [Parameter(Mandatory = $true)]
    [string] $SourceDirectory,

    [Parameter(Mandatory = $true)]
    [string] $DestinationPath
  )

  $FixedTimestamp = [DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
  $SourceRoot = (Resolve-Path -LiteralPath $SourceDirectory).Path
  $SourceRootWithSeparator = $SourceRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
  $Files = Get-ChildItem -LiteralPath $SourceRoot -Recurse -File | Sort-Object {
    $_.FullName.Substring($SourceRootWithSeparator.Length).Replace("\", "/")
  }

  $ArchiveStream = [System.IO.File]::Open($DestinationPath, [System.IO.FileMode]::CreateNew)

  try {
    $Archive = [System.IO.Compression.ZipArchive]::new(
      $ArchiveStream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false
    )

    try {
      foreach ($File in $Files) {
        $EntryName = $File.FullName.Substring($SourceRootWithSeparator.Length).Replace("\", "/")
        $Entry = $Archive.CreateEntry($EntryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $Entry.LastWriteTime = $FixedTimestamp

        $EntryStream = $Entry.Open()
        $FileStream = [System.IO.File]::OpenRead($File.FullName)

        try {
          $FileStream.CopyTo($EntryStream)
        } finally {
          $FileStream.Dispose()
          $EntryStream.Dispose()
        }
      }
    } finally {
      $Archive.Dispose()
    }
  } finally {
    $ArchiveStream.Dispose()
  }
}

New-DeterministicZip -SourceDirectory $BuildDir -DestinationPath $ZipPath

if (-not (Test-Path -LiteralPath $ZipPath) -or (Get-Item -LiteralPath $ZipPath).Length -eq 0) {
  throw "Package artifact was not created correctly: $ZipPath"
}

Write-Host "Packaged Floun extension: $ZipPath"

if ($AliasZipPath -ne $ZipPath) {
  Copy-Item -LiteralPath $ZipPath -Destination $AliasZipPath -Force

  if (-not (Test-Path -LiteralPath $AliasZipPath) -or (Get-Item -LiteralPath $AliasZipPath).Length -eq 0) {
    throw "Package alias artifact was not created correctly: $AliasZipPath"
  }

  Write-Host "Packaged Floun extension alias: $AliasZipPath"
}
