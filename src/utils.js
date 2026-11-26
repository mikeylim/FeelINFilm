export async function api(path, options) {
  const response = await fetch(`/api/${path}`, options)
  return jsonResponse(response)
}

const unavailable = 'The movie server is unavailable. Try again shortly.'
const requestFailed = 'Something went wrong. Try again.'

function errorMessage(error) {
  const message = typeof error === 'string' ? error : error?.message
  return typeof message === 'string' && message.trim() ? message.trim() : requestFailed
}

async function jsonResponse(response) {
  if (response.status === 404 && response.headers.get('x-vercel-error') === 'NOT_FOUND') {
    throw new Error('The movie API is missing from this deployment.')
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(unavailable)
  }
  const data = await response.json().catch(() => { throw new Error(unavailable) })
  if (!response.ok) throw new Error(errorMessage(data?.error))
  return data
}

export async function requestRecommendations(data, signal, onUpdate) {
  return requestUpdates('chat', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, onUpdate)
}

export async function requestUpdates(path, options, onUpdate) {
  const response = await fetch(`/api/${path}`, {
    ...options, headers: { ...options.headers, Accept: 'application/x-ndjson' }
  })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    return jsonResponse(response)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let completed = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error('The request was interrupted. Try again.')
      pending += decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'error') throw new Error(errorMessage(event.error))
        if (event.type === 'done') {
          completed = true
          return event.result
        }
        onUpdate(event)
      }
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function readStorage(key, fallback, storage = 'localStorage') {
  try { return JSON.parse(window[storage].getItem(`feelinfilm.${key}`)) ?? fallback } catch { return fallback }
}

export function saveStorage(key, value, storage = 'localStorage') {
  try { window[storage].setItem(`feelinfilm.${key}`, JSON.stringify(value)) } catch { /* Browsing may continue without persistence. */ }
}

export const movieYear = movie => movie.date?.slice(0, 4)
export function runtimeText(minutes) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  return [hours && `${hours}h`, minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(' ')
}

export function languageName(code) {
  if (!code) return ''
  if (code === 'cn') return 'Cantonese'
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) } catch { return code }
}

export function releaseDate(date) {
  if (!date) return ''
  const value = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(value.valueOf()) ? date : new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(value)
}

export function parseCalendarDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const value = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date ? value : null
}

export const filmPath = movie => `/movie/${movie.id}`
export const linkOut = { target: '_blank', rel: 'noopener noreferrer' }
export const readPath = () => window.location.pathname + window.location.search
export const morePrompt = 'Give me more recommendations with the same criteria. Avoid films you already suggested.'
