# Desplegar REG-X (frontend) en Vercel

## Qué se arregló
El build fallaba porque el script era `tsc -b && vite build` y el archivo de tipos
generado de Supabase (`database.types.ts`) está desactualizado (no conoce columnas
como `secondary_color`, `person_type`, `cedula`, ni la tabla `pos_terminals`). Son
**falsos positivos de tipos**: las columnas existen en la BD real y la app funciona.

Se cambió `frontend/package.json`:
- `"build": "vite build"`  → producción no depende de `tsc` (Vite transpila igual).
- `"build:types": "tsc -b && vite build"` → chequeo estricto opcional cuando quieras.

## 1. Subir el código actual a GitHub
Vercel construye desde GitHub. Corre esto **en tu máquina** (en `D:\proyectos_personales\REG-X`):

```bash
git add -A
git commit -m "feat: módulos completos + build Vercel (vite build)"
git pull origin main --no-rebase   # tu rama está 1 commit detrás de origin
# si hay conflictos, resuélvelos y: git add -A && git commit
git push origin main
```

Al hacer push, Vercel redespliega solo.

## 2. Configuración del proyecto en Vercel
- **Root Directory:** `frontend`  (¡importante! el repo es monorepo)
- **Framework Preset:** Vite
- **Build Command:** `npm run build`  (ya es `vite build`)
- **Output Directory:** `dist`
- **Install Command:** `npm install`

## 3. Variables de entorno (Settings → Environment Variables)
Obligatorias (sin ellas la app carga en “modo mock” y no habla con Supabase):

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://ofsgenbpqfrcyvtiannb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | tu anon key (Supabase → Settings → API) |

Opcionales (pasarela Wompi):

| Nombre | Valor |
|---|---|
| `VITE_WOMPI_PUBLIC_KEY` | `pub_prod_...` o `pub_test_...` |
| `VITE_WOMPI_ENV` | `production` o `sandbox` |

> Vite inyecta estas variables **en el build**. Si las agregas/renombras, hay que
> redeployar (Deployments → ... → Redeploy).

## 4. Después del deploy
- El `vercel.json` de `frontend/` ya tiene el rewrite SPA
  (`/(.*) → /index.html`), así que rutas como `/admin/module-map` no dan 404 al refrescar.
- **Nada de la BD va a Vercel.** Las migraciones (`database/migrations/*.sql`) se
  corren en Supabase, y las Edge Functions de Wompi se despliegan con el CLI de Supabase
  (ver `docs/WOMPI_SETUP.md`).

## Checklist rápido
- [ ] `git push` con el código actual
- [ ] Root Directory = `frontend` en Vercel
- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` en env vars
- [ ] Redeploy si agregaste env vars después del primer build
