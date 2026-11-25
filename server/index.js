import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi, sendJson } from './api.js'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const index = resolve(root, 'index.html')
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
}

try {
  await stat(index)
} catch {
  console.error('Run npm run build before starting the server.')
  process.exit(1)
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (pathname.startsWith('/api/')) return handleApi(request, response)
    if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { error: 'Method not allowed.' })
    const file = resolve(root, `.${pathname}`)
    if (!file.startsWith(`${resolve(root)}${sep}`) && file !== resolve(root)) {
      return sendJson(response, 404, { error: 'File not found.' })
    }
    const isRoute = pathname === '/' || pathname === '/lookup' || pathname === '/watchlist' || /^\/movie\/\d+$/.test(pathname)
    const asset = isRoute ? index : file
    const info = await stat(asset).catch(() => null)
    if (!info?.isFile()) return sendJson(response, 404, { error: 'Page not found.' })
    response.writeHead(200, {
      'Content-Type': mime[extname(asset)] || 'application/octet-stream', 'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': asset === index ? 'no-cache' : pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
    })
    if (request.method === 'HEAD') return response.end()
    const stream = createReadStream(asset)
    stream.on('error', () => response.destroy())
    response.on('close', () => stream.destroy())
    stream.pipe(response)
  } catch {
    sendJson(response, 400, { error: 'Invalid request.' })
  }
}).listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', function () {
  console.log(`FeelINFilm is listening on http://${this.address().address}:${this.address().port}`)
})
