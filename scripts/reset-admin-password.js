/**
 * REG-X — Reset password del usuario admin via Supabase Admin API
 * Ejecutar: node scripts/reset-admin-password.js
 */

require('dotenv').config({ path: './.env' })
const https = require('https')

const SUPABASE_URL          = process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const SUPABASE_ANON_KEY     = process.env.SUPABASE_ANON_KEY?.trim()

const TARGET_EMAIL    = 'admin@regx.test'
const NEW_PASSWORD    = 'Admin1234!'

const C = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
}
const ok   = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`)
const fail = (m) => console.log(`  ${C.red}✗${C.reset} ${m}`)
const info = (m) => console.log(`  ${C.cyan}i${C.reset} ${m}`)
const sep  = ()  => console.log(`\n${C.bold}${'─'.repeat(55)}${C.reset}`)

async function httpRequest(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : ''
    const urlObj  = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port:     urlObj.port || 443,
      path:     urlObj.pathname + (urlObj.search || ''),
      method,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
    if (payload) req.write(payload)
    req.end()
  })
}

async function main() {
  sep()
  console.log(`${C.bold} PASO 1 — Buscar usuario ${TARGET_EMAIL}${C.reset}\n`)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    fail('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están definidas en .env')
    process.exit(1)
  }

  // List users to find the UID
  const listRes = await httpRequest(
    'GET',
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
    null,
    {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  )

  if (listRes.status !== 200) {
    fail(`Error al listar usuarios: HTTP ${listRes.status}`)
    info(`Body: ${listRes.body.slice(0, 300)}`)
    process.exit(1)
  }

  const data  = JSON.parse(listRes.body)
  const users = data.users ?? data
  const user  = (Array.isArray(users) ? users : []).find(u => u.email === TARGET_EMAIL)

  if (!user) {
    fail(`No se encontró el usuario ${TARGET_EMAIL} en Supabase`)
    info('Créalo en: https://supabase.com/dashboard → Authentication → Users → Add user')
    process.exit(1)
  }

  ok(`Usuario encontrado: ${user.email} (uid: ${user.id})`)
  info(`Estado: ${user.email_confirmed_at ? 'Confirmado ✓' : 'NO confirmado'}`)

  // ── PASO 2: Resetear contraseña ─────────────────────────────
  sep()
  console.log(`${C.bold} PASO 2 — Establecer contraseña: ${NEW_PASSWORD}${C.reset}\n`)

  const updateRes = await httpRequest(
    'PUT',
    `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
    {
      password:              NEW_PASSWORD,
      email_confirm:         true,   // confirmar email si no está confirmado
    },
    {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  )

  if (updateRes.status === 200) {
    ok(`Contraseña actualizada a: ${C.cyan}${NEW_PASSWORD}${C.reset}`)
  } else {
    fail(`Error al actualizar: HTTP ${updateRes.status}`)
    info(`Body: ${updateRes.body.slice(0, 300)}`)
    process.exit(1)
  }

  // ── PASO 3: Verificar login ──────────────────────────────────
  sep()
  console.log(`${C.bold} PASO 3 — Verificar login con nueva contraseña${C.reset}\n`)

  const loginRes = await httpRequest(
    'POST',
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    { email: TARGET_EMAIL, password: NEW_PASSWORD, grant_type: 'password' },
    {
      apikey:        SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    }
  )

  if (loginRes.status === 200) {
    const token = JSON.parse(loginRes.body)
    ok(`${C.green}${C.bold}¡LOGIN EXITOSO!${C.reset}`)
    info(`Email:        ${token.user?.email}`)
    info(`Access token: ${token.access_token?.slice(0, 40)}...`)
    console.log()
    console.log(`${C.bold}${C.green} ✅ TODO OK — Ahora puedes hacer login en el frontend con:${C.reset}`)
    console.log(`     Email:    ${TARGET_EMAIL}`)
    console.log(`     Password: ${NEW_PASSWORD}`)
  } else {
    let errBody = {}
    try { errBody = JSON.parse(loginRes.body) } catch {}
    fail(`Login falló: HTTP ${loginRes.status} — ${errBody.error_description || errBody.message || loginRes.body.slice(0, 150)}`)
  }

  sep()
  console.log()
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
