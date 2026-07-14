#!/usr/bin/env node
/**
 * REG-X — Puente cajón monedero por Ethernet
 * ============================================
 * Escucha HTTP en localhost:8765 y reenvía el comando ESC/POS
 * "kick" al puerto 9100 de la impresora térmica via TCP.
 *
 * La caja conectada por RJ11 a la impresora se abre cuando
 * la impresora recibe este comando.
 *
 * USO:
 *   node cash-drawer-bridge.js <IP_IMPRESORA> [PUERTO]
 *
 * Ejemplo:
 *   node cash-drawer-bridge.js 192.168.1.100
 *   node cash-drawer-bridge.js 192.168.1.100 9100
 *
 * El frontend guarda la IP en Configuración → Cajón monedero.
 * Este proceso debe quedar corriendo en el PC del cajero.
 * Para que arranque solo al encender el PC, agrega una tarea
 * programada o un acceso directo en la carpeta de inicio de Windows.
 */

const net  = require('net')
const http = require('http')

// Comando ESC/POS: ESC p 0 25 250
// Pin 2 del RJ11 — compatible con la mayoría de cajones monedero
const KICK = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])

const PRINTER_IP   = process.argv[2] || '192.168.1.100'
const PRINTER_PORT = parseInt(process.argv[3] || '9100', 10)
const BRIDGE_PORT  = 8765
// Escuchar en todas las interfaces para que dispositivos Android en la
// misma red WiFi/LAN puedan conectarse usando la IP local del PC.
const BRIDGE_HOST  = '0.0.0.0'

// ── Servidor HTTP ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS: permite llamadas desde cualquier origen local
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // GET /status — health check
  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, printer: `${PRINTER_IP}:${PRINTER_PORT}` }))
    return
  }

  // POST /print — impresión directa ESC/POS (sin diálogo del navegador)
  if (req.url === '/print' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      let buffer
      try {
        const payload = JSON.parse(body)
        buffer = Buffer.from(payload.data, 'base64')
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }))
        return
      }

      const socket = new net.Socket()
      let done = false
      socket.setTimeout(4000)

      socket.connect(PRINTER_PORT, PRINTER_IP, () => {
        socket.write(buffer, () => {
          socket.destroy()
          if (!done) {
            done = true
            console.log(`[${timestamp()}] Recibo impreso → ${PRINTER_IP}:${PRINTER_PORT} (${buffer.length} bytes)`)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          }
        })
      })
      socket.on('timeout', () => {
        socket.destroy()
        if (!done) { done = true; res.writeHead(504); res.end(JSON.stringify({ ok: false, error: 'Timeout' })) }
      })
      socket.on('error', e => {
        if (!done) { done = true; res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message })) }
      })
    })
    return
  }

  // POST /open — abrir cajón
  if (req.url === '/open' && req.method === 'POST') {
    const socket = new net.Socket()
    let done = false

    socket.setTimeout(3000)

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(KICK, () => {
        socket.destroy()
        if (!done) {
          done = true
          console.log(`[${timestamp()}] Cajón abierto → ${PRINTER_IP}:${PRINTER_PORT}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        }
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      if (!done) {
        done = true
        console.error(`[${timestamp()}] Timeout conectando a ${PRINTER_IP}:${PRINTER_PORT}`)
        res.writeHead(504, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Timeout: impresora no responde' }))
      }
    })

    socket.on('error', (e) => {
      if (!done) {
        done = true
        console.error(`[${timestamp()}] Error TCP:`, e.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: e.message }))
      }
    })

    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
  // Obtener IPs locales para mostrar al usuario
  const os = require('os')
  const localIPs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   REG-X — Puente Cajón Monedero                  ║')
  console.log('╠══════════════════════════════════════════════════╣')
  console.log(`║  Impresora TCP  ${PRINTER_IP}:${PRINTER_PORT}`.padEnd(51) + '║')
  console.log('║                                                  ║')
  console.log('║  Desde este PC:                                  ║')
  console.log(`║    http://localhost:${BRIDGE_PORT}`.padEnd(51) + '║')
  if (localIPs.length > 0) {
    console.log('║                                                  ║')
    console.log('║  Desde Android / otros dispositivos en red:      ║')
    localIPs.forEach(ip => {
      console.log(`║    http://${ip}:${BRIDGE_PORT}`.padEnd(51) + '║')
    })
  }
  console.log('║                                                  ║')
  console.log('║  Copia la URL de red en REG-X → Config → Hardware║')
  console.log('║  Deja esta ventana abierta durante el turno.     ║')
  console.log('╚══════════════════════════════════════════════════╝')
})

function timestamp() {
  return new Date().toLocaleTimeString('es-CO')
}
