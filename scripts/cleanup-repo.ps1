# REG-X — limpieza de higiene del repo (PowerShell).
# Ejecuta SOLO con el working tree limpio (git commit / stash primero).
# Todo es recuperable con git, pero revisa el diff antes de commitear.
# Uso:  .\scripts\cleanup-repo.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "==> Verificando working tree limpio..."
if (git status --porcelain) {
    Write-Host "ERROR: tienes cambios sin commitear. Commitea o haz stash antes de correr esto." -ForegroundColor Red
    exit 1
}

function Try-GitMv($src, $dst) {
    if (Test-Path $src) { git mv $src $dst }
}

Write-Host "==> Moviendo scripts sueltos de la raiz a scripts/"
Try-GitMv 'reset-password.js'   'scripts/'
Try-GitMv 'setup-superadmin.js' 'scripts/'
Try-GitMv 'setup-tenant.js'     'scripts/'

Write-Host "==> Moviendo SQL sueltos de la raiz a database/setup/"
New-Item -ItemType Directory -Force -Path 'database/setup' | Out-Null
Try-GitMv 'regx_setup_completo.sql'   'database/setup/'
Try-GitMv 'setup-superadmin-rls.sql'  'database/setup/'
Try-GitMv 'supabase_rls_products.sql' 'database/setup/'

Write-Host "==> Borrando basura de desarrollo del frontend"
foreach ($f in 'frontend/parse.js','frontend/test_col.js','frontend/test_products.js','frontend/test_tenants.js') {
    if (Test-Path $f) { git rm -f $f }
}

Write-Host ""
Write-Host "==> Listo. Revisa con 'git status' y 'git diff --staged', luego commitea:" -ForegroundColor Green
Write-Host "    git commit -m 'chore: reorganizar scripts y limpiar basura de desarrollo'"
