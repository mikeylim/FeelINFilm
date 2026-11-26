import { setTimeout as delay } from 'node:timers/promises'
import { academySource, academyWinners, directOscarQuestion, explicitOscarFilters, latestOscarYear, requestsOscarWins, verifiedOscarWins } from './oscars.js'
import { geminiKey, geminiModel, movieByImdb, normalize, providers, requireTmdb, resolveFilm, yearOf } from './providers.js'
import { withRatingsFor } from './ratings.js'
import { providerJson, RequestError } from './upstream.js'

const fallbackModel = 'gemini-3.5-flash-lite'
const preferredTimeout = 16_000
const flashLiteTimeout = 24_000
const generationBudget = 40_000
const maxRecommendations = 10
const alternateCandidates = 2
const countWords = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ')
const countToken = `(\\d{1,3}|${countWords.join('|')})`
const statedCount = new RegExp(
  `\\b(?:top|(?:short ?list|list) of|(?:give|show) (?:me|us)|recommend(?: me)?|suggest(?: me)?|pick|find(?: me)?|need|want) ` +
  `(?:just |only |exactly )?${countToken}\\b(?! (?:minutes?|mins?|hours?|hrs?|stars?|percent)\\b)`
)
let retryPreferredAfter = 0

export function requireRecommendations(messages, options = {}) {
  const awardQuestion = !options.lockFilters && directOscarQuestion(messages?.at(-1)?.text)
  if (awardQuestion) return awardQuestion
  requireTmdb()
  if (!geminiKey) throw new RequestError('Movie chat needs a Gemini API key. Set GEMINI_API_KEY in .env and restart the server.', 503)
}

const string = { type: 'string' }
const integer = { type: 'integer' }
const number = { type: 'number' }
const boolean = { type: 'boolean' }
const names = { type: 'array', items: string, maxItems: 5 }
const recommendationSchema = {
  type: 'object',
  properties: {
    text: string,
    movies: {
      type: 'array', maxItems: maxRecommendations + alternateCandidates,
      items: {
        type: 'object',
        properties: { title: string, originalTitle: string, year: integer, reason: string },
        required: ['title', 'year', 'reason']
      }
    },
    followUps: { type: 'array', maxItems: 3, items: string },
    count: integer,
    requestedCount: integer,
    filters: {
      type: 'object',
      properties: {
        startYear: integer, endYear: integer, maxRuntime: integer, minRuntime: integer,
        minIMDb: number, minTomatometer: integer, minLetterboxd: number, minReviewScore: number,
        originalLanguages: names, requiredGenres: names, excludedGenres: names,
        directors: names, cast: names,
        oscarWinner: boolean, oscarCeremonyYear: integer, oscarStartYear: integer, oscarEndYear: integer,
        oscarCategories: names, oscarRequireAllCategories: boolean
      }
    }
  },
  required: ['text', 'movies', 'followUps', 'filters']
}

const instructions = [
  'You are FeelINFilm, a conversational movie guide. Answer in the user’s language in plain text.',
  'Pick real films from your full knowledge of cinema. Prefer feature films unless the user requests shorts or a short-film award category. Follow the user’s mood, taste and current request. Keep prior constraints unless the user changes them.',
  'For a recommendation request, set count to 3 or 4 for a quick decision or a narrow request, and 5 or 6 for a typical request. Use 8 to 10 when the newest user request explicitly asks for a long list without a specific number.',
  `Set requestedCount only if the newest user request specifies how many films to show. Use that number up to ${maxRecommendations} as the target when selecting picks. A release year, decade, runtime, or rating is never a requested count.`,
  `Choose the target number of relevant films in order, followed by ${alternateCandidates} alternates that meet the same constraints when available. Keep the same sizing rules for follow-ups.`,
  'For each candidate give its English or international title, its original title if different, its first release year, and one short spoiler-free reason tied to the user’s request. Exclude movies the user named as examples unless they requested those titles.',
  'Use the intro to explain what connects the picks in one or two sentences. Leave counts, titles, ratings, and factual claims about award wins out of the intro. Details are looked up separately. Ask a clarifying question only when a useful selection is impossible.',
  'Set filters only for genuine requirements. For qualitative preferences like great, cozy, dark, or acclaimed pick accordingly. A year in the name of a reference movie does not filter the recommendations. A decade requirement uses its first and last years.',
  'Use maxRuntime and minRuntime for explicit running-time limits in minutes. For under a whole number of minutes, subtract one from that number.',
  'Use originalLanguages only when the user requires original-language films. Use two-letter original language codes. Use requiredGenres for genres each pick must have, with TMDB labels such as Science Fiction and Animation. Use full credited names in directors and cast only when explicitly required.',
  'Use minIMDb, minTomatometer, or minLetterboxd only for a requested numeric threshold. Use minReviewScore on a 10-point scale only for an explicit request to include only well-reviewed movies without a specific rating source.',
  'For Oscar winner requests set oscarWinner, and distinguish wins from nominations. Put the calendar year the ceremony was held in oscarCeremonyYear. Use oscarStartYear and oscarEndYear for a ceremony-year range. Ceremony years do not constrain a film’s release year.',
  'Use oscarCategories for requested categories, naming them in English, such as Best Picture, Directing, Actor in a Leading Role, or Writing (Original Screenplay). Set oscarRequireAllCategories only when each film must have won every requested category. The server checks every win, so leave award claims out of the intro and reasons.',
  'Return up to two distinct, short follow-up prompts that naturally refine this conversation.'
].join(' ')

function chatContents(messages, excluded, carriedFilters, lockFilters, watchedTitles = []) {
  const contents = []
  for (const { role, text } of messages) {
    const nextRole = role === 'assistant' ? 'model' : 'user'
    if (contents.at(-1)?.role === nextRole) contents.at(-1).parts.push({ text })
    else contents.push({ role: nextRole, parts: [{ text }] })
  }
  if (excluded.length) {
    contents.at(-1).parts.push({ text: `Exclude these previously suggested films from this reply: ${JSON.stringify(excluded.map(({ title }) => title))}` })
  }
  if (watchedTitles.length) {
    contents.at(-1).parts.push({ text: `Exclude these films the user has already watched: ${JSON.stringify(watchedTitles)}` })
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
    if (rule.type === 'boolean') {
      if (value === true) values[key] = value
    } else if (rule.type !== 'array' && positive(input || {}, key)) {
      values[key] = value
    }
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

function recommendationLimit(reply, prompt) {
  const token = statedCount.exec(prompt)?.[1]
  const exact = Number(token) || countWords.indexOf(token) + 1
  if (exact > 0) return Math.min(exact, maxRecommendations)
  if (/\b(?:short ?list|quick (?:list|picks?|decision))\b/.test(prompt)) return reply.count === 3 ? 3 : 4
  if (Number.isSafeInteger(reply.requestedCount) && reply.requestedCount > 0) {
    return Math.min(reply.requestedCount, maxRecommendations)
  }
  return [3, 4, 5, 6, 8, 9, 10].includes(reply.count) ? reply.count : 6
}

function explicitRuntimeLimit(prompt) {
  const match = /\b(under|less than|at most|up to|no more than) (\d{1,3}) (?:minutes?|mins?)\b|\b(\d{1,3}) (?:minutes?|mins?) or less\b/.exec(prompt)
  if (!match || /\b(?:not|avoid|exclude|except|no)(?: [a-z]+){0,2} $/.test(prompt.slice(0, match.index))) return 0
  const strict = match[1] === 'under' || match[1] === 'less than'
  return Number(match[2] || match[3]) - Number(strict)
}

function matchesMovie(movie, filters) {
  const year = yearOf(movie.date)
  const earliest = positive(filters, 'startYear')
  const latest = positive(filters, 'endYear')
  const longest = positive(filters, 'maxRuntime')
  const shortest = positive(filters, 'minRuntime')
  const languages = list(filters, 'originalLanguages')
  const excluded = list(filters, 'excludedGenres')
  return (
    (!earliest || year >= earliest) && (!latest || (year && year <= latest)) &&
    (!longest || (movie.runtime && movie.runtime <= longest)) && (!shortest || movie.runtime >= shortest) &&
    (!languages.length || languages.includes(movie.language)) &&
    hasNames(movie.directors, list(filters, 'directors')) &&
    hasNames(movie.creditedCast, list(filters, 'cast')) &&
    hasNames(movie.genres, list(filters, 'requiredGenres')) &&
    !movie.genres.some(genre => excluded.includes(normalize(genre)))
  )
}

function matchesRatings(movie, filters) {
  const fallbackReview = movie.votes >= 100 ? movie.vote : 0
  const minimumReview = positive(filters, 'minReviewScore')
  const fieldMinimums = [
    ['imdb', 'minIMDb'], ['rt', 'minTomatometer'], ['letterboxd', 'minLetterboxd']
  ]
  return (!minimumReview || (Number(movie.ratings.imdb) || fallbackReview) >= minimumReview) &&
    fieldMinimums.every(([field, name]) => {
      const minimum = positive(filters, name)
      return !minimum || Number.parseFloat(movie.ratings[field]) >= minimum
    })
}

async function askGemini(model, contents, signal, timeout) {
  const generationConfig = { responseMimeType: 'application/json', responseJsonSchema: recommendationSchema, maxOutputTokens: 4500 }
  const thinkingLevel = { [fallbackModel]: 'MINIMAL', 'gemini-3.8-flash': 'LOW' }[model]
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel }
  const result = await providerJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      signal, method: 'POST',
      headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents, generationConfig })
    }, 'Gemini', timeout, { model }
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

async function generateRecommendation(contents, emit, signal) {
  const cooldown = retryPreferredAfter
  const model = Date.now() < cooldown ? fallbackModel : geminiModel
  const deadline = performance.now() + generationBudget
  try {
    const timeout = model === fallbackModel ? flashLiteTimeout : preferredTimeout
    return { model, reply: await askGemini(model, contents, signal, timeout) }
  } catch (error) {
    signal?.throwIfAborted()
    const retryModel = model === fallbackModel ? geminiModel : fallbackModel
    const canRetry = error.status === 504 || [0, 500, 502, 503, 504].includes(error.upstreamStatus)
    const canSwitchOnQuota = error.status === 429 && model !== retryModel
    if (!canRetry && !canSwitchOnQuota) throw error

    if (model === fallbackModel && retryPreferredAfter === cooldown) retryPreferredAfter = 0
    emit({ type: 'stage', stage: 'backup' })
    await delay(500 + Math.floor(Math.random() * 500), undefined, { signal })
    const remaining = Math.floor(deadline - performance.now())
    if (remaining <= 0) throw error
    const retryTimeout = retryModel === fallbackModel ? flashLiteTimeout : preferredTimeout
    const reply = await askGemini(retryModel, contents, signal, Math.min(retryTimeout, remaining))
    if (model !== fallbackModel) retryPreferredAfter = Date.now() + 60_000
    return { model: retryModel, reply }
  }
}

function publicCard({ id, title, date, poster, language, genres, runtime, imdbId, rtUrl, letterboxdUrl, ratings, directors, reason, oscarWins }) {
  return { id, title, date, poster, language, genres, runtime, imdbId, rtUrl, letterboxdUrl, ratings, directors, reason, oscarWins }
}

function rankedMatches(results, limit) {
  const matches = new Map()
  let slots = limit
  for (const movie of results) {
    // Reserve a slot for each pending higher-ranked candidate so shown picks stay in the final list.
    if (movie === undefined) slots -= 1
    else if (movie && !matches.has(movie.id)) {
      matches.set(movie.id, movie)
      slots -= 1
    }
    if (!slots) break
  }
  return [...matches.values()]
}

async function verifyCandidates(candidates, verify, limit, publish, signal) {
  const pending = new Map(candidates.map((candidate, index) => [index,
    resolveFilm(candidate, signal).then(movie => ({ index, movie }), error => ({ index, error }))
  ]))
  const results = Array(candidates.length)
  let firstError
  let successfulLookups = 0
  let published = 0
  let matches = []

  while (pending.size) {
    const { index, movie, error } = await Promise.race(pending.values())
    signal?.throwIfAborted()
    pending.delete(index)
    if (error) firstError ??= error
    else successfulLookups += 1
    results[index] = movie ? verify(movie) : null
    matches = rankedMatches(results, limit)
    if (publish && matches.length > published) {
      published = matches.length
      publish(matches)
    }
    if (matches.length === limit) break
  }

  if (!successfulLookups && firstError) throw firstError
  return matches
}

async function answerOscarQuestion({ year, category, key }, emit, signal) {
  const winners = academyWinners(year, key)
  const criteria = { oscarWinner: true, oscarCeremonyYear: year, oscarCategories: [category] }
  const base = { source: 'academy', criteria, awardSource: academySource(year), followUps: [] }
  if (!winners.length) return {
    ...base, movies: [],
    text: year > latestOscarYear ? `The Academy Awards records in FeelINFilm cover ceremonies through ${latestOscarYear}.`
      : `I couldn’t find a recorded winner in that category at the ${year} Oscars.`
  }

  const text = winners.map(win => {
    const award = win.recipients ? `${win.recipients} won ${win.category} for ${win.title}` : `${win.title} won ${win.category}`
    return `${award} at the ${year} Oscars.`
  }).join(' ')
  const result = { ...base, text, movies: [] }
  if (!providers.tmdb) return result

  emit({ type: 'stage', stage: 'matching' })
  const imdbIds = [...new Set(winners.map(win => win.imdbId))]
  const lookedUp = await Promise.allSettled(imdbIds.map(movieByImdb))
  signal?.throwIfAborted()
  const matches = lookedUp.flatMap(item => item.status === 'fulfilled' && item.value
    ? [{ ...item.value, oscarWins: verifiedOscarWins(item.value.imdbId, criteria) }] : [])
  if (!matches.length) return result

  emit({ type: 'cards', result: { ...result, movies: matches.map(publicCard) } })
  emit({ type: 'stage', stage: 'ratings' })
  const movies = await withRatingsFor(matches)
  signal?.throwIfAborted()
  return { ...result, movies: movies.map(publicCard) }
}

export async function liveRecommendations(messages, excluded, emit = () => {}, signal, options = {}) {
  const awardQuestion = requireRecommendations(messages, options)
  if (awardQuestion) return answerOscarQuestion(awardQuestion, emit, signal)
  emit({ type: 'stage', stage: 'gemini' })
  const carriedFilters = filterSet(options.filters)
  const contents = chatContents(messages, excluded, carriedFilters, options.lockFilters, options.watchedTitles)
  const { model, reply } = await generateRecommendation(contents, emit, signal)
  signal?.throwIfAborted()

  const latestPrompt = messages.at(-1)?.text
  const prompt = normalize(latestPrompt?.replace(/\b\d+(?:[.,]\d+|%)/g, ' '))
  const filters = options.lockFilters ? carriedFilters : explicitOscarFilters(filterSet(reply.filters), latestPrompt)
  const maxRuntime = options.lockFilters ? 0 : explicitRuntimeLimit(prompt)
  if (maxRuntime > 0) filters.maxRuntime = maxRuntime
  const limit = recommendationLimit(reply, prompt)
  const candidates = reply.movies.slice(0, limit + alternateCandidates).filter(movie => movie && typeof movie === 'object')
  const awardRequest = requestsOscarWins(filters)
  const awardSource = academySource(filters.oscarCeremonyYear)
  const text = awardRequest ? 'The Academy Award wins are shown on each film card.' : reply.text.trim().slice(0, 1000)
  const followUps = Array.isArray(reply.followUps) ? [...new Set(reply.followUps.filter(value => typeof value === 'string').map(value => value.trim().slice(0, 110)).filter(Boolean))].slice(0, 3) : []
  const base = { source: 'gemini', model, criteria: filters, text: text || 'Here are a few films to explore.', followUps, awardSource }
  if (!candidates.length) return {
    ...base,
    text: awardRequest ? missesText(filters, excluded.length, options.watchedIds?.length) : text || 'What kind of movie are you in the mood for?',
    movies: []
  }

  emit({ type: 'stage', stage: 'matching' })
  const watchedIds = options.watchedIds || []
  const excludedIds = new Set([...watchedIds, ...excluded.map(movie => movie.id)])
  const needsRatings = ['minIMDb', 'minTomatometer', 'minLetterboxd', 'minReviewScore'].some(key => positive(filters, key))
  const publish = needsRatings ? undefined : matches => emit({ type: 'cards', result: { ...base, movies: matches.map(publicCard) } })
  const verify = movie => {
    if (excludedIds.has(movie.id) || !matchesMovie(movie, filters)) return null
    if (!awardRequest) return movie
    const oscarWins = verifiedOscarWins(movie.imdbId, filters)
    return oscarWins.length ? { ...movie, reason: '', oscarWins } : null
  }

  const matches = await verifyCandidates(candidates, verify, needsRatings ? candidates.length : limit, publish, signal)
  if (matches.length) emit({ type: 'stage', stage: 'ratings' })
  const enriched = await withRatingsFor(matches)
  signal?.throwIfAborted()
  const movies = enriched.filter(movie => matchesRatings(movie, filters)).slice(0, limit).map(publicCard)
  return {
    ...base,
    text: movies.length ? base.text : missesText(filters, excluded.length, watchedIds.length),
    movies
  }
}

function missesText(filters, excludedCount, watchedCount) {
  if (filters.oscarCeremonyYear > latestOscarYear || filters.oscarStartYear > latestOscarYear) {
    return `The Academy Awards records in FeelINFilm cover ceremonies through ${latestOscarYear}.`
  }
  if (positive(filters, 'minLetterboxd') || positive(filters, 'minTomatometer') || positive(filters, 'minIMDb')) {
    return 'I couldn’t verify the requested scores for enough matches. Try a different score source or ask for picks without a score minimum.'
  }
  if (watchedCount) return 'I couldn’t find fresh matches. Try broadening your request or including watched films.'
  if (requestsOscarWins(filters)) return 'I couldn’t verify a fresh winner matching those criteria. Try a broader category or another ceremony.'
  if (excludedCount) return 'I couldn’t verify any fresh matches for these constraints. Try loosening one of them.'
  return 'I couldn’t verify any matches for this request. Try adjusting a constraint or giving me another example film.'
}
