# _archive — código fuera de servicio

Archivado el 2026-07-26. Nada de esta carpeta participa del build ni del deploy.

**¿Por qué?** La app funciona 100% con el frontend hablando directo a Supabase
(RLS + RPCs). El backend NestJS nunca se conectó al flujo real y mantenerlo
"a medias" generaba confusión y superficie de ataque aparente.

Contenido:

- `backend/` — API NestJS completa (nunca usada por el frontend en producción).
- `Dockerfile` y `docker-compose.yml` — infraestructura del stack backend.
- `frontend-lib-api.ts` — cliente axios del frontend hacia el backend
  (vivía en `frontend/src/lib/api.ts`; ningún archivo lo importaba).

**Para revivirlo:** mover `backend/` a la raíz, restaurar `"backend"` en
`workspaces` del package.json raíz y devolver los scripts `dev:backend`,
`build:backend`, `start` y `docker:*` (ver historial de git del package.json).
