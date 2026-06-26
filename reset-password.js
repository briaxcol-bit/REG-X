// Ejecutar desde la raiz del proyecto: node reset-password.js
const https = require('https')

const SUPABASE_HOST = 'ofsgenbpqfrcyvtiannb.supabase.co'
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDgwMCwiZXhwIjoyMDk3NjYwODAwfQ.WU2wCMpv-9tcbt8NXfL6MzYT5oZR3UbZXuT094apfAQ'
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mc2dlbmJwcWZyY3l2dGlhbm5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQ4MDAsImV4cCI6MjA5NzY2MDgwMH0.5vhyhXZFclanWc5EFPnTYq0CqsQqg1NBJ2VfFI5noO4'
const TARGET_EMAIL  = 'briax.col@gmail.com'
const NEW_PASSWORD  = 'Admin123!'
const USER_UID      = '8f9bfd38-3448-4622-a40b-25eb4ac74277'

function req(method, path, body, useAnon = false) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const key  = useAnon ? ANON_KEY : SERVICE_KEY
    const opts = {
      hostname: SUPABASE_HOST,
      path,
      method,
      headers: {
        apikey:           key,
        Authorization:    `Bearer ${key}`,
        'Content-Type':   'application/json',
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

async function main() {
  // 1. Actualizar contraseña + confirmar email
  console.log(`\n🔑 Actualizando contraseña para ${TARGET_EMAIL} ...`)
  const upd = await req('PUT', `/auth/v1/admin/users/${USER_UID}`, {
    password:      NEW_PASSWORD,
    email_confirm: true,
  })
  console.log('   Admin PUT status:', upd.status)
  if (upd.status !== 200) {
    console.error('❌ Fallo al actualizar:', upd.body)
    return
  }

  // 2. Leer usuario para verificar email_confirmed_at
  console.log(`\n📋 Verificando estado del usuario...`)
  const get = await req('GET', `/auth/v1/admin/users/${USER_UID}`)
  const u   = get.body
  console.log('   email:              ', u.email)
  console.log('   email_confirmed_at: ', u.email_confirmed_at ?? '⚠️  NO CONFIRMADO')
  console.log('   banned_until:       ', u.banned_until ?? 'no baneado')

  // 3. Probar login directo contra el endpoint de tokens
  console.log(`\n🔐 Probando login con ${TARGET_EMAIL} / ${NEW_PASSWORD} ...`)
  const token = await req('POST', '/auth/v1/token?grant_type=password', {
    email:    TARGET_EMAIL,
    password: NEW_PASSWORD,
  }, true /* anon key */)

  if (token.status === 200) {
    console.log('\n✅  LOGIN EXITOSO — las credenciales funcionan correctamente')
    console.log('    Ya puedes iniciar sesión en el navegador\n')
  } else {
    console.error('\n❌  Login falló:', token.status, token.body)
    console.log('\n    Intenta desde el dashboard de Supabase:')
    console.log('    Authentication → Users → briax.col@gmail.com → Edit → poner contraseña\n')
  }
}

main().catch(e => console.error('Error fatal:', e.message))
