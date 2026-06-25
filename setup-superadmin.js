/**
 * REG-X — Setup Super Admin
 * Crea briax.col@gmail.com como SUPER_ADMIN de plataforma + OWNER del tenant demo
 * Ejecutar: node setup-superadmin.js
 */
const https = require('https')

const SUPABASE_HOST = 'ofsgenbpqfrcyvtiannb.supabase.co'
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDgwMCwiZXhwIjoyMDk3NjYwODAwfQ.WU2wCMpv-9tcbt8NXfL6MzYT5oZR3UbZXuT094apfAQ'

const EMAIL     = 'briax.col@gmail.com'
const PASSWORD  = 'RegX@Admin#2026!'   // ← contraseña segura
const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const BRANCH_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

function api(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: SUPABASE_HOST,
      path,
      method,
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=representation',
        ...extraHeaders,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }
    const r = https.request(opts, res => {
      let b = ''
      res.on('data', d => (b += d))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }) }
        catch { resolve({ status: res.statusCode, body: b }) }
      })
    })
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

async function upsert(table, row, onConflict) {
  const res = await api('POST', `/rest/v1/${table}?on_conflict=${onConflict}`, row)
  if (res.status >= 400) {
    console.error(`  ❌ ${table}:`, res.status, JSON.stringify(res.body).slice(0, 120))
    return false
  }
  console.log(`  ✅ ${table} OK`)
  return true
}

async function main() {
  console.log('\n🔐 Configurando Super Admin para', EMAIL, '...\n')

  // ── 1. Buscar si el usuario ya existe en Supabase Auth ────────
  console.log('1. Verificando usuario en Supabase Auth...')
  const list = await api('GET', '/auth/v1/admin/users?per_page=1000')
  const users = Array.isArray(list.body) ? list.body : (list.body.users ?? [])
  let user    = users.find(u => u.email === EMAIL)
  let userId

  if (user) {
    userId = user.id
    console.log(`   Usuario encontrado (${userId}). Actualizando contraseña...`)
    const upd = await api('PUT', `/auth/v1/admin/users/${userId}`, {
      password:      PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Daniel — Super Admin' },
    })
    if (upd.status !== 200) {
      console.error('   ❌ Error actualizando:', upd.body)
      return
    }
    console.log('   ✅ Contraseña actualizada')
  } else {
    console.log('   Usuario no existe. Creando...')
    const cre = await api('POST', '/auth/v1/admin/users', {
      email:         EMAIL,
      password:      PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Daniel — Super Admin' },
    })
    if (cre.status !== 200 && cre.status !== 201) {
      console.error('   ❌ Error creando usuario:', cre.status, cre.body)
      return
    }
    userId = cre.body.id
    console.log(`   ✅ Usuario creado (${userId})`)
  }

  console.log('\n2. Configurando tablas públicas...')

  // ── 2. Tenant ─────────────────────────────────────────────────
  await upsert('tenants', {
    id:            TENANT_ID,
    name:          'REG-X Demo',
    slug:          'regx-demo',
    business_type: 'STORE',
    plan:          'ENTERPRISE',
    country:       'CO',
    currency:      'USD',
    timezone:      'America/Bogota',
    locale:        'es-CO',
    primary_color: '#F20D18',
    is_active:     true,
    created_by:    userId,
  }, 'id')

  // ── 3. Branch ─────────────────────────────────────────────────
  await upsert('branches', {
    id:         BRANCH_ID,
    tenant_id:  TENANT_ID,
    name:       'Sucursal Principal',
    code:       'MAIN-01',
    is_main:    true,
    is_active:  true,
    currency:   'USD',
    timezone:   'America/Bogota',
    created_by: userId,
  }, 'id')

  // ── 4. User profile con platform_role = SUPER_ADMIN ───────────
  await upsert('user_profiles', {
    id:            userId,
    full_name:     'Daniel',
    platform_role: 'SUPER_ADMIN',
    locale:        'es-CO',
  }, 'id')

  // ── 5. User tenant role como OWNER ────────────────────────────
  await upsert('user_tenant_roles', {
    user_id:   userId,
    tenant_id: TENANT_ID,
    branch_id: BRANCH_ID,
    role:      'OWNER',
    is_active: true,
  }, 'user_id,tenant_id')

  // ── 6. Suscripción ENTERPRISE ─────────────────────────────────
  await upsert('subscriptions', {
    tenant_id:            TENANT_ID,
    plan:                 'ENTERPRISE',
    status:               'ACTIVE',
    billing_cycle:        'MONTHLY',
    price:                0,
    currency:             'USD',
    current_period_start: new Date().toISOString(),
    current_period_end:   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'tenant_id')

  // ── 7. Verificar login ────────────────────────────────────────
  console.log('\n3. Verificando credenciales...')
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQ4MDAsImV4cCI6MjA5NzY2MDgwMH0.5vhyhXZFclanWc5EFPnTYq0CqsQqg1NBJ2VfFI5noO4'
  const tok = await api('POST', '/auth/v1/token?grant_type=password',
    { email: EMAIL, password: PASSWORD },
    { apikey: ANON, Authorization: `Bearer ${ANON}` }
  )
  if (tok.status === 200 && tok.body.access_token) {
    console.log('   ✅ Login verificado correctamente')
  } else {
    console.error('   ❌ Login falló:', tok.status, tok.body)
  }

  console.log('\n' + '═'.repeat(50))
  console.log('✅  Super Admin configurado exitosamente')
  console.log('═'.repeat(50))
  console.log('   Email:    ', EMAIL)
  console.log('   Password: ', PASSWORD)
  console.log('   Rol:       SUPER_ADMIN (plataforma) + OWNER (tenant)')
  console.log('   User ID:  ', userId)
  console.log('═'.repeat(50) + '\n')
}

main().catch(e => console.error('Error fatal:', e.message))
