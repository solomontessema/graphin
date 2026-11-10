<#
.SYNOPSIS
  Builds Graphin and uploads it to a subfolder of IONOS shared hosting over SFTP (WinSCP).

.DESCRIPTION
  Modelled on Petalide's deploy.ps1. It
    1. builds the interface for a subfolder ("npm run build:ionos", output in deploy\dist),
    2. assembles the files to upload in deploy\stage:
         index.html, assets\      the interface
         index.php                the API entry point
         .htaccess                site rules
         app\src, app\vendor      the PHP code (app\.htaccess closes the folder to the web),
    3. uploads deploy\stage into the remote folder (default /graphin).

  The server's settings file, app\config.local.php (database host, name, user, password), is NEVER uploaded by this
  script. It is left out of the upload by name, and the script stops if it ever finds one in what it is about to
  upload. Whatever you edit on the server stays. On a brand-new server, copy deploy\config.local.example.php to
  /app/config.local.php by hand and fill it in.

  The SFTP login is in deploy\sftp.txt (git-ignored). Copy deploy\sftp.example.txt and fill it in.

.PARAMETER SkipBuild
  Reuse the last build in deploy\dist.

.PARAMETER NoUpload
  Build and assemble deploy\stage, but upload nothing. For checking the package.

.PARAMETER Remote
  The remote folder. Default /graphin.

.EXAMPLE
  .\deploy\deploy.ps1
#>
param(
  [switch]$SkipBuild,
  [switch]$NoUpload,
  [string]$Remote = '/graphin'
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$root = Split-Path $here -Parent
$winscp = 'C:\Program Files (x86)\WinSCP\WinSCP.com'
$login = Join-Path $here 'sftp.txt'
$log = Join-Path $here 'deploy.log'

function Invoke-Step([string]$name, [scriptblock]$action) {
  Write-Host "`n== $name" -ForegroundColor Cyan
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $action } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE) { throw "$name failed (exit code $LASTEXITCODE)." }
}

if ($Remote -notmatch '^/[A-Za-z0-9_-]+$') { throw "Remote must be one top-level folder such as /graphin, not '$Remote'." }
if (-not (Test-Path $winscp)) { throw "WinSCP not found at $winscp" }
if (-not (Test-Path $login)) { throw 'deploy\sftp.txt not found. Copy deploy\sftp.example.txt to deploy\sftp.txt and fill it in.' }
$open = Get-Content $login | Where-Object { $_ -match '^\s*open\s' } | Select-Object -First 1
if (-not $open) { throw 'No "open" line found in deploy\sftp.txt.' }

# Runs WinSCP commands in one session. The script is a temp file so the password never appears on a command line.
function Invoke-WinScp([string[]]$commands, [string]$name) {
  $script = Join-Path $env:TEMP "graphin-deploy-$PID.txt"
  try {
    Set-Content -Path $script -Encoding ASCII -Value (@('option batch abort', 'option confirm off', $open) + $commands + 'exit')
    Invoke-Step $name { & $winscp /script=$script /log=$log /loglevel=0 }
  } finally {
    Remove-Item -LiteralPath $script -ErrorAction SilentlyContinue
  }
}

# 1. Build
if (-not $SkipBuild) {
  Push-Location (Join-Path $root 'frontend')
  try { Invoke-Step 'Build interface' { npm run build:ionos } } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $here 'dist\index.html'))) { throw 'deploy\dist\index.html is missing. Run without -SkipBuild.' }

# 2. Assemble
Write-Host "`n== Assemble deploy\stage" -ForegroundColor Cyan
$stage = Join-Path $here 'stage'
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage, (Join-Path $stage 'app') | Out-Null
Copy-Item (Join-Path $here 'dist\*') $stage -Recurse
Copy-Item (Join-Path $root 'public\index.php') (Join-Path $stage 'index.php')
Copy-Item (Join-Path $here 'htaccess-site') (Join-Path $stage '.htaccess')
Copy-Item (Join-Path $root 'src') (Join-Path $stage 'app\src') -Recurse
Copy-Item (Join-Path $root 'vendor') (Join-Path $stage 'app\vendor') -Recurse
Copy-Item (Join-Path $here 'htaccess-app') (Join-Path $stage 'app\.htaccess')
# Safety: no settings, passwords or database dumps may be in what we upload.
$bad = Get-ChildItem $stage -Recurse -Force -File | Where-Object { $_.Name -in @('config.local.php', '.env', 'sftp.txt') -or $_.Extension -eq '.sql' }
if ($bad) { throw "Refusing to upload: $($bad.FullName -join ', ')" }
php -l (Join-Path $stage 'index.php') | Out-Null
if ($LASTEXITCODE) { throw 'index.php has a syntax error.' }

if ($NoUpload) {
  Write-Host "`nAssembled deploy\stage. Nothing uploaded." -ForegroundColor Green
  return
}

# 3. Upload. Old hashed bundles in assets\ are removed first so they do not pile up; nothing else is deleted.
$commands = @(
  'option batch continue',
  "rm $Remote/assets/*",
  'option batch abort',
  # The server's settings file is excluded by name, as a second guard on top of the check above.
  "put -transfer=binary -filemask=`"|config.local.php`" `"$stage\*`" $Remote/"
)
Invoke-WinScp $commands "Upload to $Remote"

Write-Host "`nDeployed to $Remote." -ForegroundColor Green
Write-Host "The server's $Remote/app/config.local.php was not touched." -ForegroundColor Yellow
