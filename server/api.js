import { liveDetails, liveSearch, liveTrending, providers } from './providers.js'
import { liveRecommendations, requireRecommendations } from './recommendations.js'
import { RequestError } from './upstream.js'

const maxBodySize = 120_000
const chatRequests = new Map()
export const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}

const requestBody = async request => {
  if (!(request.headers['content-type'] || '').startsWith('application/json')) {
    throw new RequestError('Send the request as JSON.', 415)
  }
  const chunks = []
  let size = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > maxBodySize) {
      request.resume()
      throw new RequestError('This message is too large.', 413)
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestError('This request contains invalid JSON.', 400)
  }
}

function chatLimit(request) {
  const now = Date.now()
  for (const [client, entry] of chatRequests) {
    if (entry.until <= now) chatRequests.delete(client)
  }
  const client = request.socket.remoteAddress
  const entry = chatRequests.get(client) || { count: 0, until: now + 60_000 }
  if (entry.count >= 12) throw new RequestError('You’ve sent several requests in a short time. Try again in a minute.', 429)
  entry.count += 1
  chatRequests.set(client, entry)
}

const streamType = 'application/x-ndjson'
const eventLine = event => JSON.stringify(event) + '\n'

async function replyToChat(request, response, messages, excluded, options) {
  requireRecommendations()
  if (!(request.headers.accept || '').includes(streamType)) {
    return sendJson(response, 200, await liveRecommendations(messages, excluded, undefined, undefined, options))
  }

  const cancel = new AbortController()
  response.once('close', () => cancel.abort())
  response.writeHead(200, {
    'Content-Type': `${streamType}; charset=utf-8`, 'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff', 'X-Accel-Buffering': 'no'
  })
  response.flushHeaders()
  const emit = event => { if (!response.destroyed) response.write(eventLine(event)) }
  const result = await liveRecommendations(messages, excluded, emit, cancel.signal, options)
  if (!response.destroyed) response.end(eventLine({ type: 'done', result }))
}

export async function handleApi(request, response) {
  try {
    const url = new URL(request.url, 'http://localhost')
    const { pathname, searchParams } = url
    if (request.method === 'GET' && pathname === '/api/home') {
      return sendJson(response, 200, { providers })
    }
    if (request.method === 'GET' && pathname === '/api/films/trending') {
      return sendJson(response, 200, { movies: await liveTrending() })
    }
    if (request.method === 'GET' && pathname === '/api/films') {
      const query = searchParams.get('query')?.trim()
      const page = Number(searchParams.get('page') || 1)
      if (!query || query.length > 120 || !Number.isInteger(page) || page < 1 || page > 500) {
        throw new RequestError('Enter a movie title of up to 120 characters.', 400)
      }
      return sendJson(response, 200, await liveSearch(query, page))
    }
    const detail = pathname.match(/^\/api\/films\/(\d{1,10})$/)
    if (request.method === 'GET' && detail) {
      return sendJson(response, 200, await liveDetails(Number(detail[1])))
    }
    if (request.method === 'POST' && pathname === '/api/chat') {
      chatLimit(request)
      const data = await requestBody(request)
      if (!Array.isArray(data?.messages) || !data.messages.length || data.messages.length > 13 ||
        data.messages.at(-1)?.role !== 'user' ||
        data.messages.some(message => !['user', 'assistant'].includes(message?.role) ||
          typeof message.text !== 'string' || !message.text.trim() || message.text.length > 1600)) {
        throw new RequestError('Send a movie request of up to 1,600 characters.', 400)
      }
      const excluded = Array.isArray(data.exclude) ? data.exclude.slice(-75).filter(movie =>
        Number.isSafeInteger(movie?.id) && typeof movie.title === 'string' && movie.title.length <= 180) : []
      const options = { filters: data.criteria, lockFilters: data.lockCriteria === true && Boolean(data.criteria) }
      return await replyToChat(request, response, data.messages, excluded, options)
    }
    throw new RequestError('This API endpoint could not be found.', 404)
  } catch (error) {
    if (response.destroyed) return
    if (!(error instanceof RequestError)) console.error('Unexpected API error:', error.name)
    const message = error instanceof RequestError ? error.message : 'Something went wrong. Try again.'
    if (response.headersSent) return response.end(eventLine({ type: 'error', error: message }))
    sendJson(response, error.status || 500, { error: message })
  }
}
