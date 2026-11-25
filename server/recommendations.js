import { geminiKey, geminiModel, normalize, requireTmdb, resolveFilm, yearOf } from './providers.js'
import { withRatingsFor } from './ratings.js'
import { providerJson, RequestError } from './upstream.js'

const fallbackModel = 'gemini-3.1-flash-lite'
let retryPreferredAfter = 0

export function requireRecommendations() {
  requireTmdb()
  if (!geminiKey) throw new RequestError('Movie chat needs a Gemini API key. Set GEMINI_API_KEY in .env and restart the server.', 503)
}

const string = { type: 'string' }
const integer = { type: 'integer' }
const number = { type: 'number' }
const names = { type: 'array', items: string, maxItems: 5 }
const recommendationSchema = {
  type: 'object',
  properties: {
    text: string,
    movies: {
      type: 'array', maxItems: 10,
      items: {
        type: 'object',
        properties: { title: string, originalTitle: string, year: integer, reason: string },
        required: ['title', 'year', 'reason']
      }
    },
    followUps: { type: 'array', maxItems: 3, items: string },
    count: integer,
    filters: {
      type: 'object',
      properties: {
        startYear: integer, endYear: integer, maxRuntime: integer, minRuntime: integer,
        minIMDb: number, minTomatometer: integer, minLetterboxd: number, minReviewScore: number,
        originalLanguages: names, requiredGenres: names, excludedGenres: names,
        directors: names, cast: names, oscarCeremonyYear: integer
      }
    }
  },
  required: ['text', 'movies', 'followUps', 'filters']
}

const instructions = [
  'You are FeelINFilm, a conversational movie guide. Answer in the user’s language in plain text.',
  'Pick real feature films from your full knowledge of cinema. Follow the user’s mood, taste and current request. Keep prior constraints unless the user changes them.',
  'For a recommendation request, choose five to eight relevant candidates in order. Include a couple of alternates so the server can still find enough verified matches. If the user requests a number, set count to that number (maximum 7).',
  'For each candidate give its English or international title, its original title if different, its first release year, and one short spoiler-free reason tied to the user’s request. Exclude movies the user named as examples unless they requested those titles.',
  'Use the intro to explain what connects the picks in one or two sentences. Leave titles, ratings, and factual claims about award wins out of the intro. Details are looked up separately. Ask a clarifying question only when a useful selection is impossible.',
  'Set filters only for genuine requirements. For qualitative preferences like great, cozy, dark, or acclaimed pick accordingly. A year in the name of a reference movie does not filter the recommendations. A decade requirement uses its first and last years.',
  'Use originalLanguages only when the user requires original-language films. Use two-letter original language codes. Use requiredGenres for genres each pick must have, with TMDB labels such as Science Fiction and Animation. Use full credited names in directors and cast only when explicitly required.',
  'Use minIMDb, minTomatometer, or minLetterboxd only for a requested numeric threshold. Use minReviewScore on a 10-point scale only for an explicit request to include only well-reviewed movies without a specific rating source.',
  'For Oscar winners at a specific ceremony, use its ceremony year for oscarCeremonyYear, consider any requested categories, and distinguish winners from nominees. Include only candidates you believe won.',
  'Return up to two distinct, short follow-up prompts that naturally refine this conversation.'
].join(' ')

function chatContents(messages, excluded, carriedFilters, lockFilters) {
  const contents = []
  for (const { role, text } of messages) {
    const nextRole = role === 'assistant' ? 'model' : 'user'
    if (contents.at(-1)?.role === nextRole) contents.at(-1).parts.push({ text })
    else contents.push({ role: nextRole, parts: [{ text }] })
  }
  if (excluded.length) {
    contents.at(-1).parts.push({ text: `Exclude these previously suggested films from this reply: ${JSON.stringify(excluded.map(({ title }) => title))}` })
  }
  if (Object.keys(carriedFilters).length) {
    const instruction = lockFilters ? 'These constraints still apply to every alternative.' : 'Here are the previous hard constraints. Carry them forward unless the newest request changes the criteria.'
    contents.at(-1).parts.push({ text: `${instruction} ${JSON.stringify(carriedFilters)}` })
  }
  return contents
}

function filterSet(input) {
  const values = {}
  for (const [key, rule] of Object.entries(recommendationSchema.properties.filters.properties)) {
    const value = input?.[key]
    if (rule.type === 'array' && Array.isArray(value)) {
      const entries = value.filter(item => typeof item === 'string' && item.trim()).slice(0, 5).map(item => item.trim().slice(0, 90))
      if (entries.length) values[key] = entries
    }
    if (rule.type !== 'array' && positive(input || {}, key)) values[key] = value
  }
  return values
}

function positive(filters, name) {
  const val = filters[name]
  return Number.isFinite(val) && val > 0 ? val : 0
}

function list(filters, name) {
  return Array.isArray(filters[name]) ? filters[name].filter(item => typeof item === 'string' && item.trim()).slice(0, 5).map(normalize) : []
}

function hasNames(values, requested) {
  const names = new Set((values || []).map(normalize))
  return requested.every(term => names.has(term))
}

function matchesMovie(movie, filters) {
  const year = yearOf(movie.date)
  const earliest = positive(filters, 'startYear')
  const latest = positive(filters, 'endYear')
  const longest = positive(filters, 'maxRuntime')
  const shortest = positive(filters, 'minRuntime')
  const languages = list(filters, 'originalLanguages')
  const excluded = list(filters, 'excludedGenres')
  const oscarYear = positive(filters, 'oscarCeremonyYear')

  return (
    (!earliest || year >= earliest) && (!latest || (year && year <= latest)) &&
    (!longest || (movie.runtime && movie.runtime <= longest)) && (!shortest || movie.runtime >= shortest) &&
    (!languages.length || languages.includes(movie.language)) &&
    hasNames(movie.directors, list(filters, 'directors')) &&
    hasNames(movie.creditedCast, list(filters, 'cast')) &&
    hasNames(movie.genres, list(filters, 'requiredGenres')) &&
    !movie.genres.some(genre => excluded.includes(normalize(genre))) &&
    (!oscarYear || !year || year <= oscarYear)
  )
}

function matchesRatings(movie, filters) {
  const fallbackReview = movie.votes >= 100 ? movie.vote : 0
  const minimumReview = positive(filters, 'minReviewScore')
  const fieldMinimums = [
    ['imdb', 'minIMDb'], ['rt', 'minTomatometer'], ['letterboxd', 'minLetterboxd']
  ]
  const knownWinner = !positive(filters, 'oscarCeremonyYear') || !movie.awards || /\bwon\s+\d+\s+(?:oscars?|academy awards?)\b/i.test(movie.awards)
  return knownWinner && (!minimumReview || (Number(movie.ratings.imdb) || fallbackReview) >= minimumReview) &&
    fieldMinimums.every(([field, name]) => {
      const minimum = positive(filters, name)
      return !minimum || Number.parseFloat(movie.ratings[field]) >= minimum
    })
}

async function askGemini(model, contents, signal) {
  const generationConfig = { responseMimeType: 'application/json', responseJsonSchema: recommendationSchema, maxOutputTokens: 4500 }
  const thinkingLevel = { 'gemini-3.1-flash-lite': 'MINIMAL', 'gemini-3.8-flash': 'LOW' }[model]
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel }
  const result = await providerJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      signal, method: 'POST',
      headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents, generationConfig })
    }, 'Gemini', model === fallbackModel ? 16_000 : 7000
  )
  try {
    const parts = result.candidates?.[0]?.content?.parts || []
    const reply = JSON.parse(parts.filter(part => !part.thought).map(part => part.text || '').join(''))
    if (typeof reply.text !== 'string' || !Array.isArray(reply.movies)) throw new Error('Invalid reply shape')
    return reply
  } catch {
    throw new RequestError('Gemini didn’t return a complete reply. Try again or shorten the request.', 502)
  }
}

function publicCard({ id, title, date, poster, language, genres, runtime, imdbId, rtUrl, letterboxdUrl, ratings, directors, reason }) {
  return { id, title, date, poster, language, genres, runtime, imdbId, rtUrl, letterboxdUrl, ratings, directors, reason }
}

export async function liveRecommendations(messages, excluded, emit = () => {}, signal, options = {}) {
  requireRecommendations()
  emit({ type: 'stage', stage: 'gemini' })
  const carriedFilters = filterSet(options.filters)
  const contents = chatContents(messages, excluded, carriedFilters, options.lockFilters)
  let model = Date.now() < retryPreferredAfter ? fallbackModel : geminiModel
  let reply
  try {
    reply = await askGemini(model, contents, signal)
  } catch (error) {
    if (model === fallbackModel || (error.status !== 504 && ![429, 500, 503, 504].includes(error.upstreamStatus))) throw error
    retryPreferredAfter = Date.now() + 60_000
    model = fallbackModel
    emit({ type: 'stage', stage: 'backup' })
    reply = await askGemini(model, contents, signal)
  }
  signal?.throwIfAborted()

  const filters = options.lockFilters ? carriedFilters : filterSet(reply.filters)
  const candidates = reply.movies.slice(0, 10).filter(movie => movie && typeof movie === 'object')
  const limit = Number.isInteger(reply.count) && reply.count > 0 ? Math.min(reply.count, 7) : 6
  const awardYear = positive(filters, 'oscarCeremonyYear')
  const awardSource = Number.isInteger(awardYear) && awardYear >= 1929 && awardYear <= new Date().getFullYear()
    ? `https://www.oscars.org/oscars/ceremonies/${awardYear}` : ''
  const text = reply.text.trim().slice(0, 1000)
  const followUps = Array.isArray(reply.followUps) ? [...new Set(reply.followUps.filter(value => typeof value === 'string').map(value => value.trim().slice(0, 110)).filter(Boolean))].slice(0, 3) : []
  const base = { source: 'gemini', model, criteria: filters, text: text || 'Here are a few films to explore.', followUps, awardSource }
  if (!candidates.length) return { ...base, text: text || 'What kind of movie are you in the mood for?', movies: [] }

  emit({ type: 'stage', stage: 'matching' })
  const results = await Promise.allSettled(candidates.map(candidate => resolveFilm(candidate)))
  signal?.throwIfAborted()
  const failures = results.filter(result => result.status === 'rejected')
  if (failures.length === results.length) throw failures[0].reason

  const seen = new Set(excluded.map(movie => movie.id))
  const matches = []
  for (const item of results) {
    const movie = item.status === 'fulfilled' && item.value
    if (movie && !seen.has(movie.id) && matchesMovie(movie, filters)) {
      seen.add(movie.id)
      matches.push(movie)
    }
  }

  const needsRatings = ['minIMDb', 'minTomatometer', 'minLetterboxd', 'minReviewScore', 'oscarCeremonyYear'].some(key => positive(filters, key))
  if (matches.length && !needsRatings) {
    emit({ type: 'cards', result: { ...base, movies: matches.slice(0, limit).map(publicCard) } })
  }
  if (matches.length && needsRatings) emit({ type: 'stage', stage: 'ratings' })
  const enriched = await withRatingsFor(needsRatings ? matches : matches.slice(0, limit), { awards: Boolean(awardYear) })
  signal?.throwIfAborted()
  const movies = enriched.filter(movie => matchesRatings(movie, filters)).slice(0, limit).map(publicCard)
  return {
    ...base,
    text: movies.length ? base.text : missesText(filters, excluded.length),
    movies
  }
}

function missesText(filters, excludedCount) {
  if (positive(filters, 'minLetterboxd') || positive(filters, 'minTomatometer') || positive(filters, 'minIMDb')) {
    return 'I couldn’t verify the requested scores for enough matches. Try a different score source or ask for picks without a score minimum.'
  }
  if (excludedCount) return 'I couldn’t verify any fresh matches for these constraints. Try loosening one of them.'
  return 'I couldn’t verify any matches for this request. Try adjusting a constraint or giving me another example film.'
}
