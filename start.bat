@echo off
chcp 65001 >nul
title REG-X — Plataforma ERP/POS

echo.
echo  ██████╗ ███████╗ ██████╗       ██╗  ██╗
echo  ██╔══██╗██╔════╝██╔════╝       ╚██╗██╔╝
echo  ██████╔╝█████╗  ██║  ███╗       ╚███╔╝
echo  ██╔══██╗██╔══╝  ██║   ██║       ██╔██╗
echo  ██║  ██║███████╗╚██████╔╝      ██╔╝ ██╗
echo  ╚═╝  ╚═╝╚══════╝ ╚═════╝       ╚═╝  ╚═╝
echo.
echo  ERP/POS SaaS Enterprise — Inicio rapido Windows
echo  ================================================
echo.

:: ── Verificar Node.js ────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js no encontrado.
  echo         Descarga Node.js 20+ desde https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=1 delims=v" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER% detectado

:: ── Verificar npm ────────────────────────────────────────────
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] npm no encontrado. Reinstala Node.js.
  pause
  exit /b 1
)
echo [OK] npm detectado

:: ── Copiar .env si no existe ─────────────────────────────────
if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Copiando .env.example a .env ...
    copy ".env.example" ".env" >nul
    echo [WARN] Edita .env con tus credenciales de Supabase y Redis antes de continuar.
    echo.
    pause
  ) else (
    echo [WARN] No se encontro .env.example. Crea un archivo .env manualmente.
  )
)

:: ── Instalar dependencias si falta node_modules ───────────────
if not exist "node_modules" (
  echo [INFO] Instalando dependencias del monorepo...
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
  echo [OK] Dependencias instaladas
)

if not exist "frontend\node_modules" (
  echo [INFO] Instalando dependencias del frontend...
  call npm install --workspace=frontend
)

:: (backend NestJS archivado en _archive/ — la app usa Supabase directamente)

:: ── Iniciar dev server ────────────────────────────────────────
echo.
echo [INFO] Iniciando servidor de desarrollo...
echo        Frontend  → http://localhost:5173
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

call npm run dev
