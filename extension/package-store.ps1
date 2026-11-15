# Builds the Chrome Web Store package of Graphin Save: extension/dist/graphin-save-<version>.zip
#
#   powershell -ExecutionPolicy Bypass -File extension\package-store.ps1

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $here 'dist'
$staging = Join-Path $dist 'store'
New-Item -ItemType Directory -Force -Path $staging, (Join-Path $staging 'icons') | Out-Null

# Only the files the extension needs go in the package. This script, the icon source and the notes stay out.
$files = @('manifest.json', 'background.js', 'bridge.js', 'lib.js', 'popup.html', 'popup.js', 'options.html', 'options.js')
foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $here $file) -Destination $staging -Force
}
foreach ($size in 16, 48, 128) {
  Copy-Item -LiteralPath (Join-Path $here "icons/icon$size.png") -Destination (Join-Path $staging 'icons') -Force
}

# Refuse to package a development address.
foreach ($file in Get-ChildItem -LiteralPath $staging -Recurse -File -Include *.js, *.json, *.html) {
  $text = Get-Content -Raw -LiteralPath $file.FullName
  if ($text -match 'https?://(localhost|127\.0\.0\.1)') {
    throw "The package still names a development address in $($file.Name)."
  }
}

$manifest = Get-Content -Raw -LiteralPath (Join-Path $here 'manifest.json') | ConvertFrom-Json
$zip = Join-Path $dist ('graphin-save-' + $manifest.version + '.zip')
if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zip
Write-Host "Wrote $zip" -ForegroundColor Green
