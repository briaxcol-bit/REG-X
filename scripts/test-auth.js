/**
 * REG-X — Script de diagnóstico de autenticación
 * Ejecutar: node scripts/test-auth.js
 */

require('dotenv').config({ path: './.env' })
const https = require('https')
const http  = require('http')

const COLORS = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
}
const ok   = (msg) => console.log(`  ${COLORS.green}✓${COLORS.reset} ${msg}`)
const fail = (msg) => console.log(`  ${COLORS.red}✗${COLORS.reset} ${msg}`)
const warn = (msg) => console.log(`  ${COLORS.yellow}⚠${COLORS.reset} ${msg}`)
const info = (msg) => console.log(`  ${COLORS.cyan}i${COLORS.reset} ${msg}`)
const sep  = ()    => console.log(`\n${COLORS.bold}${'─'.repeat(55)}${COLORS.reset}`)

// ── 1. Check .env variables ──────────────────────────────────
sep()
console.log(`${COLORS.bold} [1/4] Variables de entorno${COLORS.reset}`)
console.log()

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL',
]

let envOk = true
for (const key of required) {
  const val = process.env[key]
  if (!val || val.trim() === '') {
    fail(`${key} — ${COLORS.red}VACÍA o no definida${COLORS.reset}`)
    envOk = false
  } else if (val.includes('placeholder') || val.includes('xxxxxxxx') || val.startsWith('eyJ...')) {
    warn(`${key} — VALOR PLACEHOLDER (no real)`)
    envOk = false
  } else {
    const preview = val.length > 40 ? val.slice(0, 20) + '...' + val.slice(-8) : val
    ok(`${key} = ${COLORS.cyan}${preview}${COLORS.reset}`)
  }
}

const SUPABASE_URL  = process.env.SUPABASE_URL?.trim()
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY?.trim()

// ── 2. Test backend health ────────────────────────────────────
sep()
console.log(`${COLORS.bold} [2/4] Health del backend (localhost:3000)${COLORS.reset}`)
console.log()

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const urlObj  = new URL(url)
    const lib     = urlObj.protocol === 'https:' ? https : http
    const options = {
      hostname: urlObj.hostname,
      port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname + (urlObj.search || ''),
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }
    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
    req.write(payload)
    req.end()
  })
}

async function main() {
  // Backend health
  try {
    const res = await httpGet('http://localhost:3000/api/v1/health')
    if (res.status === 200) {
      ok(`Backend respondió: HTTP ${res.status}`)
      info(`Body: ${res.body.slice(0, 120)}`)
    } else {
      warn(`Backend respondió con HTTP ${res.status} (intentando /api/v1/health)`)
    }
  } catch (e) {
    fail(`Backend no responde en localhost:3000 — ${e.message}`)
    warn('Asegúrate de que "npm run dev" esté corriendo')
  }

  // ── 3. Test Supabase connection ──────────────────────────────
  sep()
  console.log(`${COLORS.bold} [3/4] Conexión a Supabase Auth${COLORS.reset}`)
  console.log()

  if (!SUPABASE_URL || !SUPABASE_ANON || SUPABASE_URL.includes('xxxxxxxx')) {
    fail('No se puede probar Supabase — URL o ANON_KEY vacías/placeholder')
  } else {
    try {
      // Check if Supabase project is reachable
      const healthUrl = `${SUPABASE_URL}/auth/v1/settings`
      // Send apikey header as requested by Supabase
      const res = await httpPost(healthUrl, {}, { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` })
      if (res.status === 200) {
        ok(`Supabase Auth endpoint alcanzable (HTTP ${res.status})`)
        try {
          const settings = JSON.parse(res.body)
          info(`Providers habilitados: ${Object.keys(settings).filter(k => settings[k] === true).join(', ') || 'N/A'}`)
        } catch {}
      } else {
        warn(`Supabase respondió HTTP ${res.status}`)
        info(`Body: ${res.body.slice(0, 200)}`)
      }
    } catch (e) {
      fail(`No se pudo alcanzar Supabase: ${e.message}`)
    }

    // ── 4. Try login via Supabase Auth directly ──────────────────
    sep()
    console.log(`${COLORS.bold} [4/4] Test de login directo con Supabase Auth${COLORS.reset}`)
    console.log()

    const testCredentials = [
      { email: 'admin@regx.test', password: 'Admin1234!' },
      { email: 'admin@regx.test', password: 'password' },
      { email: 'admin@regx.test', password: 'admin123' },
    ]

    for (const creds of testCredentials) {
      info(`Probando: ${creds.email} / ${creds.password}`)
      try {
        const res = await httpPost(
          `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
          { email: creds.email, password: creds.password, grant_type: 'password' },
          { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        )
        if (res.status === 200) {
          const data = JSON.parse(res.body)
          ok(`${COLORS.green}¡LOGIN EXITOSO!${COLORS.reset} Token: ${data.access_token?.slice(0, 30)}...`)
          info(`Usuario: ${JSON.stringify(data.user?.email)}`)
          break
        } else {
          let errBody = {}
          try { errBody = JSON.parse(res.body) } catch {}
          const errMsg = errBody.error_description || errBody.message || errBody.msg || res.body.slice(0, 150)
          if (errMsg.includes('Invalid login credentials')) {
            fail(`HTTP ${res.status} — Credenciales INCORRECTAS para este usuario en Supabase`)
            warn('  → Verifica que el usuario exista en Supabase Dashboard → Authentication → Users')
          } else {
            fail(`HTTP ${res.status} — ${errMsg}`)
          }
        }
      } catch (e) {
        fail(`Error de red: ${e.message}`)
      }
    }

    // Also try via backend /auth/login
    sep()
    console.log(`${COLORS.bold} [EXTRA] Test de login vía backend /api/v1/auth/login${COLORS.reset}`)
    console.log()
    try {
      const res = await httpPost(
        'http://localhost:3000/api/v1/auth/login',
        { email: 'admin@regx.test', password: 'Admin1234!' },
      )
      info(`HTTP ${res.status}: ${res.body.slice(0, 200)}`)
      if (res.status === 200 || res.status === 201) {
        ok('Backend login exitoso')
      } else {
        warn('Backend devolvió error (ver body arriba)')
      }
    } catch (e) {
      fail(`Backend /auth/login no responde: ${e.message}`)
    }
  }

  sep()
  console.log()
  console.log(`${COLORS.bold} RESUMEN DE DIAGNÓSTICO${COLORS.reset}`)
  console.log()
  if (!envOk) {
    console.log(`  ${COLORS.red}${COLORS.bold}⚠ PROBLEMA PRINCIPAL: Las variables de Supabase en .env están vacías o son placeholder.${COLORS.reset}`)
    console.log()
    console.log('  Pasos para solucionar:')
    console.log('  1. Ve a https://supabase.com/dashboard → tu proyecto → Settings → API')
    console.log('  2. Copia Project URL → SUPABASE_URL')
    console.log('  3. Copia anon/public key → SUPABASE_ANON_KEY')
    console.log('  4. Copia service_role key → SUPABASE_SERVICE_ROLE_KEY')
    console.log('  5. Ve a Settings → JWT Settings → copia JWT Secret → SUPABASE_JWT_SECRET')
    console.log('  6. Reinicia el backend: Ctrl+C → npm run dev')
  } else {
    console.log(`  ${COLORS.green}Variables de entorno OK.${COLORS.reset}`)
  }
  console.log()
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
