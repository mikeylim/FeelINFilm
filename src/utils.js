import { inLanguage } from '../shared/locale.js'

async function fetchApi(path, options, locale) {
  try {
    return await fetch(`/api/${path}`, { ...options, headers: { ...options.headers, 'Accept-Language': locale } })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new Error(unavailable(locale))
  }
}

export async function api(path, { locale = 'en', ...options } = {}) {
  return jsonResponse(await fetchApi(path, options, locale), locale)
}

const unavailable = locale => inLanguage(locale, {
  en: 'The movie server is unavailable. Try again shortly.',
  ko: '영화 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  fr: 'Le serveur de films est indisponible. Réessayez dans un instant.'
})

function errorMessage(error, locale) {
  const message = typeof error === 'string' ? error : error?.message
  return typeof message === 'string' && message.trim() ? message.trim() :
    inLanguage(locale, { en: 'Something went wrong. Try again.', ko: '문제가 발생했습니다. 다시 시도해 주세요.', fr: 'Une erreur est survenue. Réessayez.' })
}

async function jsonResponse(response, locale) {
  if (response.status === 404 && response.headers.get('x-vercel-error') === 'NOT_FOUND') {
    throw new Error(inLanguage(locale, {
      en: 'The movie API is missing from this deployment.', ko: '이 배포에 영화 API가 설정되지 않았습니다.',
      fr: 'L’API de films est absente de ce déploiement.'
    }))
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(unavailable(locale))
  }
  const data = await response.json().catch(() => { throw new Error(unavailable(locale)) })
  if (!response.ok) throw new Error(errorMessage(data?.error, locale))
  return data
}

export async function requestRecommendations(data, signal, onUpdate, locale) {
  return requestUpdates('chat', {
    method: 'POST', signal, locale,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }, onUpdate)
}

export async function requestUpdates(path, { locale = 'en', ...options }, onUpdate) {
  const response = await fetchApi(path, {
    ...options, headers: { ...options.headers, Accept: 'application/x-ndjson' }
  }, locale)
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    return jsonResponse(response, locale)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let completed = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error(inLanguage(locale, {
        en: 'The request was interrupted. Try again.', ko: '요청이 중단되었습니다. 다시 시도해 주세요.',
        fr: 'La demande a été interrompue. Réessayez.'
      }))
      pending += decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'error') throw new Error(errorMessage(event.error, locale))
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
export const movieTitle = (movie, locale) => movie.titles?.[locale] || movie.title

export function runtimeText(minutes, locale) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const units = inLanguage(locale, { en: ['h', 'm'], ko: ['시간', '분'], fr: ['\u00a0h', '\u00a0min'] })
  return [hours && `${hours}${units[0]}`, minutes % 60 && `${minutes % 60}${units[1]}`].filter(Boolean).join(' ')
}

export function languageName(code, locale = 'en') {
  if (!code) return ''
  if (code === 'cn') return inLanguage(locale, { en: 'Cantonese', ko: '광둥어', fr: 'cantonais' })
  try { return new Intl.DisplayNames(locale, { type: 'language' }).of(code) } catch { return code }
}

export function releaseDate(date, locale = 'en') {
  if (!date) return ''
  const value = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(value.valueOf()) ? date : new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(value)
}

export function awardsSummary(summary, locale) {
  if (!summary || locale === 'en') return summary
  const totals = /^(?:Won (\d+) Oscars?\. )?(\d+) wins? & (\d+) nominations? total\.?$/i.exec(summary)
  if (!totals) return summary
  const [, oscars, wins, nominations] = totals
  const plural = count => count === '1' ? '' : 's'
  return inLanguage(locale, {
    en: summary,
    ko: `${oscars ? `아카데미상 ${oscars}개 수상. ` : ''}총 ${wins}회 수상 및 ${nominations}회 후보 지명.`,
    fr: `${oscars ? `${oscars} Oscar${plural(oscars)}. ` : ''}${wins} récompense${plural(wins)} et ${nominations} nomination${plural(nominations)} au total.`
  })
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
