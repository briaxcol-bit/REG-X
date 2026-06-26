#Requires -Version 5.1
<#
.SYNOPSIS
    REG-X — Script de inicio para Windows (PowerShell)
.DESCRIPTION
    Verifica prerequisitos, instala dependencias y levanta los servidores de
    desarrollo (backend NestJS + frontend Vite) con un solo comando.
.EXAMPLE
    .\start.ps1
    .\start.ps1 -Docker        # También levanta Postgres y Redis vía Docker
    .\start.ps1 -Production    # Build de producción y sirve en un solo proceso
    .\start.ps1 -Clean         # Limpia node_modules antes de instalar
#>

param(
  [switch]$Docker,
  [switch]$Production,
  [switch]$Clean,
  [switch]$Help
)

# ── Colores / helpers ─────────────────────────────────────────────────────────
function Write-Header {
  $c = [char]27
  Write-Host ""
  Write-Host " $c[91m██████╗ ███████╗ ██████╗       ██╗  ██╗$c[0m"
  Write-Host " $c[91m██╔══██╗██╔════╝██╔════╝       ╚██╗██╔╝$c[0m"
  Write-Host " $c[91m██████╔╝█████╗  ██║  ███╗       ╚███╔╝ $c[0m"
  Write-Host " $c[91m██╔══██╗██╔══╝  ██║   ██║       ██╔██╗ $c[0m"
  Write-Host " $c[91m██║  ██║███████╗╚██████╔╝      ██╔╝ ██╗$c[0m"
  Write-Host " $c[91m╚═╝  ╚═╝╚══════╝ ╚═════╝       ╚═╝  ╚═╝$c[0m"
  Write-Host ""
  Write-Host " ERP/POS SaaS Enterprise" -ForegroundColor Gray
  Write-Host " ================================================" -ForegroundColor DarkGray
  Write-Host ""
}

function Write-Step   { param($msg) Write-Host "  $([char]0x25B6) $msg" -ForegroundColor Cyan }
function Write-OK     { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn   { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err    { param($msg) Write-Host "  [ERROR] $msg" -ForegroundColor Red }
function Write-Info   { param($msg) Write-Host "  $msg" -ForegroundColor Gray }

function Exit-WithError { param($msg) Write-Err $msg; Read-Host "Presiona Enter para salir"; exit 1 }

# ── Help ──────────────────────────────────────────────────────────────────────
if ($Help) {
  Get-Help $MyInvocation.MyCommand.Path
  exit 0
}

# ── Header ────────────────────────────────────────────────────────────────────
Write-Header

# ── Verificar Node.js ────────────────────────────────────────────────────────
Write-Step "Verificando Node.js..."
try {
  $nodeVer = (node -v 2>&1).ToString().TrimStart('v')
  $major   = [int]($nodeVer.Split('.')[0])
  if ($major -lt 20) {
    Exit-WithError "Se requiere Node.js 20+. Version actual: $nodeVer. Descarga desde https://nodejs.org"
  }
  Write-OK "Node.js v$nodeVer"
} catch {
  Exit-WithError "Node.js no encontrado. Descarga desde https://nodejs.org"
}

# ── Verificar npm ─────────────────────────────────────────────────────────────
try {
  $npmVer = (npm -v 2>&1).ToString().Trim()
  Write-OK "npm v$npmVer"
} catch {
  Exit-WithError "npm no encontrado. Reinstala Node.js."
}

# ── Verificar/copiar .env ─────────────────────────────────────────────────────
Write-Step "Verificando configuracion .env..."
if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Warn ".env creado desde .env.example"
    Write-Warn "IMPORTANTE: Edita .env con tus credenciales de Supabase y Redis."
    Write-Host ""
    $continue = Read-Host "  Continuar de todas formas? (s/n)"
    if ($continue -ne 's' -and $continue -ne 'S') { exit 0 }
  } else {
    Write-Warn "No se encontro .env.example. Crea un archivo .env manualmente."
  }
} else {
  Write-OK ".env encontrado"
}

# ── Limpieza opcional ─────────────────────────────────────────────────────────
if ($Clean) {
  Write-Step "Limpiando node_modules y dist..."
  npm run clean 2>&1 | Out-Null
  Write-OK "Limpieza completada"
}

# ── Instalar dependencias ─────────────────────────────────────────────────────
Write-Step "Verificando dependencias..."

$needsInstall = (-not (Test-Path "node_modules")) -or
               (-not (Test-Path "frontend\node_modules")) -or
               (-not (Test-Path "backend\node_modules"))

if ($needsInstall) {
  Write-Info "Instalando paquetes del monorepo (puede tardar 2-3 min la primera vez)..."
  $installResult = npm install 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Fallo la instalacion de dependencias:"
    Write-Host $installResult
    exit 1
  }
  Write-OK "Dependencias instaladas"
} else {
  Write-OK "Dependencias ya instaladas"
}

# ── Docker opcional ───────────────────────────────────────────────────────────
if ($Docker) {
  Write-Step "Verificando Docker..."
  try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Step "Levantando Postgres, Redis y Kong..."
    docker-compose up -d postgres redis kong
    if ($LASTEXITCODE -eq 0) {
      Write-OK "Contenedores iniciados"
      Write-Info "Esperando que los servicios estén listos..."
      Start-Sleep -Seconds 4
    }
  } catch {
    Write-Warn "Docker no disponible o no esta corriendo. Asegura que Docker Desktop esté iniciado."
  }
} else {
  $dockerRunning = $false
  try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerRunning = $true }
  } catch {}

  if ($dockerRunning) {
    Write-Info "Tip: Usa -Docker para levantar Postgres/Redis automáticamente"
  }
}

# ── Modo producción ───────────────────────────────────────────────────────────
if ($Production) {
  Write-Step "Compilando para produccion..."
  Write-Info "1/2 Build del backend..."
  npm run build:backend
  if ($LASTEXITCODE -ne 0) { Exit-WithError "Fallo el build del backend" }

  Write-Info "2/2 Build del frontend..."
  npm run build:frontend
  if ($LASTEXITCODE -ne 0) { Exit-WithError "Fallo el build del frontend" }

  Write-OK "Build completo"
  Write-Host ""
  Write-Host "  Iniciando servidor unificado..." -ForegroundColor Green
  Write-Host "  URL → " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
  Write-Host ""
  $env:NODE_ENV = "production"
  npm run start
  exit 0
}

# ── Dev servers ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor DarkGray
Write-Host "  │  Backend  →  " -NoNewline -ForegroundColor DarkGray
Write-Host "http://localhost:3000" -NoNewline -ForegroundColor Cyan
Write-Host "             │" -ForegroundColor DarkGray
Write-Host "  │  Frontend →  " -NoNewline -ForegroundColor DarkGray
Write-Host "http://localhost:5173" -NoNewline -ForegroundColor Magenta
Write-Host "             │" -ForegroundColor DarkGray
Write-Host "  │  Swagger  →  " -NoNewline -ForegroundColor DarkGray
Write-Host "http://localhost:3000/api/docs" -NoNewline -ForegroundColor Yellow
Write-Host "  │" -ForegroundColor DarkGray
Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Presiona " -NoNewline -ForegroundColor Gray
Write-Host "Ctrl+C" -NoNewline -ForegroundColor Red
Write-Host " para detener." -ForegroundColor Gray
Write-Host ""

npm run dev
