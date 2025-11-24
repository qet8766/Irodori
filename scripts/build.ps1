$ErrorActionPreference = "Stop"

param(
  [switch]$SkipInstall,
  [switch]$SkipClean
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required on PATH. Install Node.js 18+ before building."
}

if (-not $SkipClean) {
  if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
  if (Test-Path "dist-electron") { Remove-Item "dist-electron" -Recurse -Force }
}

if (-not $SkipInstall -or -not (Test-Path "node_modules")) {
  npm ci
}

npm run electron:build

Write-Host "`nBuild complete."
Write-Host "- Renderer bundle: dist/"
Write-Host "- Electron main/preload bundle: dist-electron/"
Write-Host "- Installers (electron-builder): dist/*.{exe,dmg,AppImage,...} depending on platform"
