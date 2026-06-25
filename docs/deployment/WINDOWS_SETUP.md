# REG-X — Guía de Configuración en Windows

## Prerequisitos

| Herramienta        | Versión mínima | Descarga                                          |
|--------------------|----------------|---------------------------------------------------|
| Node.js            | 20.x LTS       | https://nodejs.org                                |
| Docker Desktop     | 4.x            | https://docs.docker.com/desktop/windows/          |
| Git                | 2.x            | https://git-scm.com/download/win                  |
| WSL2               | 2.x            | `wsl --install` en PowerShell como Admin          |
| kubectl (opcional) | 1.28+          | `winget install Kubernetes.kubectl`               |

> **IMPORTANTE**: Docker Desktop en Windows requiere WSL2 habilitado.  
> Ejecutar en PowerShell como Administrador: `wsl --install`

---

## Setup inicial

```powershell
# 1. Clonar repositorio
git clone https://github.com/tu-org/reg-x.git
cd reg-x

# 2. Copiar variables de entorno
copy .env.example .env
# Editar .env con tus credenciales de Supabase

# 3. Instalar dependencias
cd frontend && npm install && cd ..
cd backend  && npm install && cd ..

# 4. Levantar servicios con Docker
docker-compose up -d postgres redis otel-collector prometheus grafana

# 5. Ejecutar migraciones
docker-compose exec postgres psql -U postgres -d regx -f /docker-entrypoint-initdb.d/migrations/001_initial_schema.sql
docker-compose exec postgres psql -U postgres -d regx -f /docker-entrypoint-initdb.d/migrations/002_rls_policies.sql
docker-compose exec postgres psql -U postgres -d regx -f /docker-entrypoint-initdb.d/migrations/003_indexes.sql
docker-compose exec postgres psql -U postgres -d regx -f /docker-entrypoint-initdb.d/migrations/004_functions_views.sql
docker-compose exec postgres psql -U postgres -d regx -f /docker-entrypoint-initdb.d/seeds/001_permissions.sql

# 6. Levantar backend en modo desarrollo
cd backend
npm run start:dev

# 7. En otra terminal — levantar frontend
cd frontend
npm run dev
```

### URLs locales

| Servicio         | URL                              | Credenciales     |
|------------------|----------------------------------|------------------|
| Frontend         | http://localhost:5173            | —                |
| Backend API      | http://localhost:3000/api        | —                |
| Swagger Docs     | http://localhost:3000/api/docs   | —                |
| Grafana          | http://localhost:3001            | admin / admin    |
| Prometheus       | http://localhost:9090            | —                |
| Kong Admin       | http://localhost:8001            | —                |

---

## Producción con Docker Compose

```powershell
# Construir imágenes production
docker-compose build --target production

# Levantar todo en producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Variables críticas para Supabase

En `.env`, configurar:
```
SUPABASE_URL=https://XXXXXXXX.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_JWT_SECRET=super-secret...
```

Estas se obtienen desde el Dashboard de Supabase → Settings → API.

---

## Scripts de Windows útiles

```powershell
# Resetear base de datos local
docker-compose down -v && docker-compose up -d postgres

# Ver logs del backend
docker-compose logs -f backend

# Entrar al contenedor de Redis
docker-compose exec redis redis-cli

# Ver métricas
Start-Process "http://localhost:9090"   # Prometheus
Start-Process "http://localhost:3001"   # Grafana
```

---

## Instalación como PWA en Windows

1. Abrir Chrome y navegar a `http://localhost:5173`
2. Hacer clic en el ícono de instalación en la barra de dirección
3. Hacer clic en "Instalar"
4. La app aparecerá en el menú Inicio de Windows

Para instalación silenciosa vía Group Policy, usar el manifest en `/public/manifest.webmanifest`.
