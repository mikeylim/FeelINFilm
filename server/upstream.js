export class RequestError extends Error {
  constructor(message, status, upstreamStatus) {
    super(typeof message === 'string' ? message : message.en)
    this.messages = typeof message === 'string' ? { en: message } : message
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
  if (process.env.PROVIDER_METRICS === '1' || [429, 504].includes(attributes.status) || geminiBusy || attributes.outcome === 'timeout') {
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
    if (deadline.aborted) throw new RequestError({ en: `${provider} took too long to respond. Try again.`, ko: `${provider} 응답 시간이 초과되었습니다. 다시 시도해 주세요.`, fr: `${provider} a mis trop de temps à répondre. Réessayez.` }, 504)
    if (status !== undefined) throw new RequestError({ en: `${provider} returned an unreadable response.`, ko: `${provider}의 응답을 읽을 수 없습니다.`, fr: `${provider} a renvoyé une réponse illisible.` }, 502)
    throw new RequestError({ en: `${provider} is unreachable right now. Try again shortly.`, ko: `${provider}에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.`, fr: `${provider} est inaccessible pour le moment. Réessayez dans un instant.` }, 502, 0)
  }
  logMetric('provider_request', { ...metricFields, provider, status, durationMs: Math.round(performance.now() - started) })
  if (status === 429) throw new RequestError({ en: `${provider} reached its request limit. Try again shortly.`, ko: `${provider} 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.`, fr: `La limite de demandes de ${provider} est atteinte. Réessayez dans un instant.` }, 429, status)
  if (status === 503 || status === 504) throw new RequestError({ en: `${provider} is temporarily busy. Try again shortly.`, ko: `${provider}에 요청이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.`, fr: `${provider} est temporairement surchargé. Réessayez dans un instant.` }, 503, status)
  if (status === 401 || status === 403) {
    throw new RequestError({ en: `${provider} rejected the request. Check its API settings in .env.`, ko: `${provider}에서 요청을 거부했습니다. .env의 API 설정을 확인해 주세요.`, fr: `${provider} a refusé la demande. Vérifiez ses paramètres API dans .env.` }, 502, status)
  }
  if (status === 404 && provider === 'TMDB') throw new RequestError({ en: 'This film could not be found.', ko: '이 영화를 찾을 수 없습니다.', fr: 'Ce film est introuvable.' }, 404, status)
  if (status === 404 && provider === 'Gemini') {
    throw new RequestError({ en: 'The configured Gemini model is unavailable. Check GEMINI_MODEL in .env.', ko: '설정된 Gemini 모델을 사용할 수 없습니다. .env의 GEMINI_MODEL을 확인해 주세요.', fr: 'Le modèle Gemini configuré est indisponible. Vérifiez GEMINI_MODEL dans .env.' }, 503, status)
  }
  if (status < 200 || status >= 300) throw new RequestError({ en: `${provider} couldn’t complete the request. Try again shortly.`, ko: `${provider}에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.`, fr: `${provider} n’a pas pu traiter la demande. Réessayez dans un instant.` }, 502, status)
  return data
}
