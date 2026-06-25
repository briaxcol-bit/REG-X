// Ejecutar: node setup-tenant.js
// Crea tenant, branch, perfil y rol para briax.col@gmail.com
const https = require('https')

const SUPABASE_HOST = 'ofsgenbpqfrcyvtiannb.supabase.co'
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDgwMCwiZXhwIjoyMDk3NjYwODAwfQ.WU2wCMpv-9tcbt8NXfL6MzYT5oZR3UbZXuT094apfAQ'

const USER_ID    = '8f9bfd38-3448-4622-a40b-25eb4ac74277'
const USER_EMAIL = 'briax.col@gmail.com'
const TENANT_ID  = 'aaaaaaaa-0000-0000-0000-000000000001'
const BRANCH_ID  = 'bbbbbbbb-0000-0000-0000-000000000001'

function rpc(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: SUPABASE_HOST,
      path,
      method,
      headers: {
        apikey:          SERVICE_KEY,
        Authorization:   `Bearer ${SERVICE_KEY}`,
        'Content-Type':  'application/json',
        Prefer:          'return=representation',
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
  const path = `/rest/v1/${table}?on_conflict=${onConflict}`
  const res = await rpc('POST', path, row)
  if (res.status >= 400) {
    console.error(`  ❌ ${table}:`, res.status, JSON.stringify(res.body))
    return false
  }
  console.log(`  ✅ ${table} OK`)
  return true
}

async function main() {
  console.log('\n🚀 Configurando tenant para', USER_EMAIL, '...\n')

  // 1. Tenant
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
    created_by:    USER_ID,
  }, 'id')

  // 2. Branch
  await upsert('branches', {
    id:        BRANCH_ID,
    tenant_id: TENANT_ID,
    name:      'Sucursal Principal',
    code:      'MAIN-01',
    is_main:   true,
    is_active: true,
    currency:  'USD',
    timezone:  'America/Bogota',
    created_by: USER_ID,
  }, 'id')

  // 3. User profile
  await upsert('user_profiles', {
    id:        USER_ID,
    full_name: 'Daniel',
    locale:    'es-CO',
  }, 'id')

  // 4. User tenant role (OWNER)
  await upsert('user_tenant_roles', {
    user_id:   USER_ID,
    tenant_id: TENANT_ID,
    branch_id: BRANCH_ID,
    role:      'OWNER',
    is_active: true,
  }, 'user_id,tenant_id')

  // 5. Subscription
  await upsert('subscriptions', {
    tenant_id:             TENANT_ID,
    plan:                  'ENTERPRISE',
    status:                'ACTIVE',
    billing_cycle:         'MONTHLY',
    price:                 0,
    currency:              'USD',
    current_period_start:  new Date().toISOString(),
    current_period_end:    new Date(Date.now() + 365*24*60*60*1000).toISOString(),
  }, 'tenant_id')

  console.log('\n✅ Setup completo!')
  console.log('   tenant_id:', TENANT_ID)
  console.log('   branch_id:', BRANCH_ID)
  console.log('\n   Ahora puedes cargar productos y el dashboard mostrará datos reales.\n')
}

main().catch(e => console.error('Error:', e.message))
