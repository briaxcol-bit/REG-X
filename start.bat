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

if not exist "backend\node_modules" (
  echo [INFO] Instalando dependencias del backend...
  call npm install --workspace=backend
)

:: ── Levantar servicios Docker (opcional) ─────────────────────
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo.
  echo [INFO] Docker detectado.
  set /p START_DOCKER="Levantar Postgres/Redis/Kong con Docker? (s/n): "
  if /i "%START_DOCKER%"=="s" (
    echo [INFO] Iniciando contenedores...
    docker-compose up -d postgres redis
    echo [OK] Contenedores iniciados
    timeout /t 3 /nobreak >nul
  )
)

:: ── Iniciar dev servers ───────────────────────────────────────
echo.
echo [INFO] Iniciando servidores de desarrollo...
echo        Backend   → http://localhost:3000
echo        Frontend  → http://localhost:5173
echo        API Docs  → http://localhost:3000/api/docs
echo.
echo  Presiona Ctrl+C para detener ambos servidores.
echo.

call npm run dev
