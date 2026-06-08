$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ProjectRoot
$PackagePath = Join-Path $ProjectRoot "package.json"
$Package = Get-Content -Raw -LiteralPath $PackagePath | ConvertFrom-Json
$QaEvidencePath = Join-Path $RepoRoot "docs\release\$($Package.version)\QA_EVIDENCE.md"

if (-not (Test-Path -LiteralPath $QaEvidencePath)) {
  throw "Manual Chrome QA evidence is missing: $QaEvidencePath"
}

$Content = Get-Content -Raw -LiteralPath $QaEvidencePath
$ManualQaSection = [regex]::Match(
  $Content,
  '## Manual Chrome QA(?<section>.*?)(?:\r?\n## |\z)',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if (-not $ManualQaSection.Success) {
  throw "Manual Chrome QA section is missing from QA evidence."
}

$Rows = @(
  [regex]::Matches($ManualQaSection.Groups["section"].Value, '^\| (?<scenario>[^|]+) \| (?<result>[^|]+) \| (?<evidence>[^|]+) \|$', [System.Text.RegularExpressions.RegexOptions]::Multiline) |
    ForEach-Object {
      [pscustomobject]@{
        Scenario = $_.Groups["scenario"].Value.Trim()
        Result = $_.Groups["result"].Value.Trim()
        Evidence = $_.Groups["evidence"].Value.Trim()
      }
    } |
    Where-Object { $_.Scenario -ne "Scenario" -and $_.Scenario -ne "---" -and $_.Result -ne "---" }
)

if ($Rows.Length -eq 0) {
  throw "Manual Chrome QA evidence table is missing or malformed."
}

$IncompleteRows = @($Rows | Where-Object { $_.Result -ne "Pass" })

if ($IncompleteRows.Length -gt 0) {
  $Details = ($IncompleteRows | ForEach-Object { "$($_.Scenario)=$($_.Result)" }) -join "; "
  throw "Manual Chrome QA is not publish-ready. Complete or fix these rows first: $Details"
}

Write-Host "Publish readiness verified."
Write-Host "Manual Chrome QA rows:"
$Rows | ForEach-Object { Write-Host " - $($_.Scenario): $($_.Result)" }
