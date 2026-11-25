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
  const geminiBusy = attributes.provider === 'Gemini' && attributes.status === 503
  if (process.env.PROVIDER_METRICS === '1' || [429, 504].includes(attributes.status) || geminiBusy) {
    console.info(JSON.stringify({ event, ...attributes }))
  }
}

export async function providerJson(url, options, provider, timeout = 8000, metricFields = {}) {
  const started = performance.now()
  const deadline = AbortSignal.timeout(timeout)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  let status
  let data
  try {
    const response = await fetch(url, { ...options, signal })
    status = response.status
    if (response.ok) data = await response.json()
  } catch {
    options.signal?.throwIfAborted()
    const outcome = deadline.aborted ? 504 : status === undefined ? 0 : 502
    logMetric('provider_request', { ...metricFields, provider, status: outcome, durationMs: Math.round(performance.now() - started) })
    if (deadline.aborted) throw new RequestError(`${provider} took too long to respond. Try again.`, 504)
    if (status !== undefined) throw new RequestError(`${provider} returned an unreadable response.`, 502)
    throw new RequestError(`${provider} is unreachable right now. Try again shortly.`, 502, 0)
  }
  logMetric('provider_request', { ...metricFields, provider, status, durationMs: Math.round(performance.now() - started) })
  if (status === 429) throw new RequestError(`${provider} reached its request limit. Try again shortly.`, 429, status)
  if (status === 503 || status === 504) throw new RequestError(`${provider} is temporarily busy. Try again shortly.`, 503, status)
  if (status === 401 || status === 403) {
    throw new RequestError(`${provider} rejected the request. Check its API settings in .env.`, 502, status)
  }
  if (status === 404 && provider === 'TMDB') throw new RequestError('This film could not be found.', 404, status)
  if (status === 404 && provider === 'Gemini') {
    throw new RequestError('The configured Gemini model is unavailable. Check GEMINI_MODEL in .env.', 503, status)
  }
  if (status < 200 || status >= 300) throw new RequestError(`${provider} couldn’t complete the request. Try again shortly.`, 502, status)
  return data
}
