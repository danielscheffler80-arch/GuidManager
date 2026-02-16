#!/usr/bin/env pwsh
<# 
This script creates three feature branches and corresponding PRs using GitHub CLI.
It works best when GH CLI is installed and authenticated.
#>
$scriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-StrictMode -Version Latest
if (-not (Test-Path (Join-Path $repoRoot .git))) {
  Write-Error "Not a Git repository at $repoRoot. Please clone the repository or initialize it first."
  exit 1
}
$ErrorActionPreference = 'Stop'

$base = 'main'

$branches = @(
  @{ Branch = 'feat/a1-3-prisma-generate'; Title = 'CI: A1.3 Prisma Client Generieren'; BodyPath = 'pr_bodies/lang/a1_3_lang.md' },
  @{ Branch = 'feat/a1-4-prisma-migrate'; Title = 'CI: A1.4 Migrationen anwenden'; BodyPath = 'pr_bodies/lang/a1_4_lang.md' },
  @{ Branch = 'feat/a1-5-prisma-seed'; Title = 'CI: A1.5 Seed-Daten hinzufügen'; BodyPath = 'pr_bodies/lang/a1_5_lang.md' }
)

function Ensure-Branch {
  param([string]$branch)
  git fetch origin | Out-Null
  $remoteExists = $(git ls-remote --heads origin $branch 2>$null) -ne $null
  if (-not $remoteExists) {
    # Try to base on main; create local branch and push
    if (git rev-parse --verify origin/$branch 2>$null) {
      git branch -D $branch | Out-Null
    }
    git checkout -B $branch origin/$base
    git push -u origin $branch
  } else {
    Write-Output "Branch $branch already exists on origin"
  }
}

foreach ($b in $branches) {
  Ensure-Branch -branch $b.Branch
  # Determine GH CLI executable path (support env GH_CLI_PATH)
  $ghExe = $env:GH_CLI_PATH
  if (-not [string]::IsNullOrEmpty($ghExe) -and (Test-Path $ghExe)) {
    $ghCmd = $ghExe
  } else {
    $ghFound = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghFound) {
      $ghCmd = "gh"
    } else {
      $ghCmd = $null
    }
  }

  if ($ghCmd) {
    # Resolve repo root and body path relative to repo root
    $scriptDir = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
    $repoRoot = Resolve-Path (Join-Path $scriptDir "..")
    $bodyPath = Join-Path $repoRoot $b.BodyPath
    $body = Get-Content -Raw -Path $bodyPath
    $pr = & $ghCmd pr create --title $b.Title --body $body --base $base --head $b.Branch
    Write-Output "Created PR: $pr"
  } else {
    Write-Output "gh CLI not found. Skipping PR creation for $($b.Branch)"
  }
}
