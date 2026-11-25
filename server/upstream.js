export class RequestError extends Error {
  constructor(message, status, upstreamStatus) {
    super(message)
    this.status = status
    this.upstreamStatus = upstreamStatus
  }
}

const cache = new Map()

export function cachedValue(key) {
  const existing = cache.get(key)
  return existing?.until > Date.now() ? existing.value : undefined
}

export function cacheFor(key, duration, load) {
  const existing = cachedValue(key)
  if (existing) return existing
  if (cache.size >= 1000) cache.delete(cache.keys().next().value)
  const value = Promise.resolve().then(load)
  cache.set(key, { value, until: Date.now() + duration })
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key)
  })
  return value
}

export function logMetric(event, attributes) {
  if (process.env.PROVIDER_METRICS === '1' || attributes.status === 429) {
    console.info(JSON.stringify({ event, ...attributes }))
  }
}

export async function providerJson(url, options, provider, timeout = 8000) {
  const started = performance.now()
  const deadline = AbortSignal.timeout(timeout)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  let response
  try {
    response = await fetch(url, { ...options, signal })
  } catch {
    logMetric('provider_request', { provider, status: deadline.aborted ? 504 : 0, durationMs: Math.round(performance.now() - started) })
    options.signal?.throwIfAborted()
    const message = deadline.aborted ? `${provider} took too long to respond. Try again.` : `${provider} is unreachable right now. Try again shortly.`
    throw new RequestError(message, deadline.aborted ? 504 : 502)
  }
  const status = response.status
  logMetric('provider_request', { provider, status, durationMs: Math.round(performance.now() - started) })
  if (status === 429) throw new RequestError(`${provider} reached its request limit. Try again shortly.`, 429, status)
  if (status === 503 || status === 504) throw new RequestError(`${provider} is temporarily busy. Try again shortly.`, 503, status)
  if (status === 401 || status === 403) {
    throw new RequestError(`${provider} rejected the request. Check its API settings in .env.`, 502, status)
  }
  if (status === 404 && provider === 'TMDB') throw new RequestError('This film could not be found.', 404, status)
  if (status === 404 && provider === 'Gemini') {
    throw new RequestError('The configured Gemini model is unavailable. Check GEMINI_MODEL in .env.', 503, status)
  }
  if (!response.ok) throw new RequestError(`${provider} couldn’t complete the request. Try again shortly.`, 502, status)
  try {
    return await response.json()
  } catch {
    options.signal?.throwIfAborted()
    throw new RequestError(`${provider} returned an unreadable response.`, 502)
  }
}
