#!/usr/bin/env bash
# REG-X — limpieza de higiene del repo.
# Ejecuta SOLO con el working tree limpio (git commit / stash primero).
# Todo es recuperable con git, pero conviene revisar el diff antes de commitear.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Verificando working tree limpio..."
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: tienes cambios sin commitear. Commitea o haz stash antes de correr esto."
  exit 1
fi

echo "==> Moviendo scripts sueltos de la raíz a scripts/"
git mv reset-password.js        scripts/ 2>/dev/null || true
git mv setup-superadmin.js      scripts/ 2>/dev/null || true
git mv setup-tenant.js          scripts/ 2>/dev/null || true

echo "==> Moviendo SQL sueltos de la raíz a database/setup/"
mkdir -p database/setup
git mv regx_setup_completo.sql    database/setup/ 2>/dev/null || true
git mv setup-superadmin-rls.sql   database/setup/ 2>/dev/null || true
git mv supabase_rls_products.sql  database/setup/ 2>/dev/null || true

echo "==> Borrando basura de desarrollo del frontend"
git rm -f frontend/parse.js frontend/test_col.js \
          frontend/test_products.js frontend/test_tenants.js 2>/dev/null || true

echo "==> Listo. Revisa con 'git status' y 'git diff --staged', luego commitea:"
echo "    git commit -m 'chore: reorganizar scripts y limpiar basura de desarrollo'"
