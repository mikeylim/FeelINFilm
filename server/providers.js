import { ratingProviders, withRatings, withRatingsFor } from './ratings.js'
import { cacheFor, logMetric, providerJson, RequestError } from './upstream.js'

const token = (process.env.TMDB_READ_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN)?.trim()
const tmdbKey = process.env.TMDB_API_KEY?.trim()
export const geminiKey = process.env.GEMINI_API_KEY?.trim()
export const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'

export const providers = {
  tmdb: Boolean(token || tmdbKey),
  gemini: Boolean(geminiKey),
  ...ratingProviders
}

export const normalize = (value = '') => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9\p{L}]+/gu, ' ').trim()
export const yearOf = date => Number(date?.slice(0, 4)) || 0

export function requireTmdb() {
  if (!providers.tmdb) throw new RequestError('Movie lookup needs a TMDB credential. Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY in .env and restart the server.', 503)
}

const tmdb = (path, params = {}, ttl = 30 * 60_000) => {
  requireTmdb()
  const query = new URLSearchParams({ language: 'en-US' })
  for (const [name, value] of Object.entries(params)) {
    if (value != null) query.set(name, value)
  }
  const key = `tmdb:${path}?${query}`
  if (!token) query.set('api_key', tmdbKey)
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  return cacheFor(key, ttl, () => providerJson(`https://api.themoviedb.org/3${path}?${query}`, { headers }, 'TMDB'))
}

const image = (path, size) => path && /^\/[a-zA-Z0-9_.-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : ''
const people = (crew, jobs) => [...new Set(crew.filter(person => jobs.includes(person.job)).map(person => person.name))]
const genreNames = new Map([[28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'],
  [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'], [14, 'Fantasy'], [36, 'History'], [27, 'Horror'],
  [10402, 'Music'], [9648, 'Mystery'], [10749, 'Romance'], [878, 'Science Fiction'], [10770, 'TV Movie'],
  [53, 'Thriller'], [10752, 'War'], [37, 'Western']])

function summary(raw) {
  const genres = raw.genres?.map(genre => genre.name) || (raw.genre_ids || []).map(id => genreNames.get(id)).filter(Boolean)
  return {
    id: raw.id, title: raw.title, date: raw.release_date,
    poster: image(raw.poster_path, 'w500'),
    backdrop: image(raw.backdrop_path, 'w1280'),
    overview: raw.overview,
    language: raw.original_language,
    vote: raw.vote_count ? raw.vote_average : null,
    votes: raw.vote_count,
    genres,
    imdbId: raw.imdb_id || raw.external_ids?.imdb_id || ''
  }
}

function certification(releases) {
  for (const country of ['CA', 'US', 'GB']) {
    const dates = releases.find(entry => entry.iso_3166_1 === country)?.release_dates || []
    const cert = dates.find(entry => entry.type === 3 && entry.certification) || dates.find(entry => entry.certification)
    if (cert) return `${cert.certification} (${country})`
  }
  return ''
}

function formatMovie(raw, detailed = false) {
  const crew = raw.credits?.crew || []
  const cast = (raw.credits?.cast || []).slice(0, detailed ? 12 : 8).map(person => ({
    name: person.name, character: person.character, image: image(person.profile_path, 'w185')
  }))
  const base = {
    ...summary(raw), runtime: raw.runtime, directors: people(crew, ['Director']), cast
  }
  if (!detailed) return base

  const videos = (raw.videos?.results || []).filter(video => video.site === 'YouTube' && /^[\w-]{11}$/.test(video.key))
  const trailer = videos.find(video => video.type === 'Trailer' && video.official) || videos.find(video => video.type === 'Trailer')
  return {
    ...base,
    titleOriginal: raw.original_title === raw.title ? '' : raw.original_title,
    tagline: raw.tagline,
    writers: people(crew, ['Writer', 'Screenplay', 'Story']),
    certification: certification(raw.release_dates?.results || []),
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '',
    languages: (raw.spoken_languages || []).map(language => language.english_name),
    countries: (raw.production_countries || []).map(country => country.name),
    companies: (raw.production_companies || []).map(company => company.name),
    budget: raw.budget,
    revenue: raw.revenue
  }
}

const detailParams = 'credits,videos,release_dates,recommendations,similar'
const rawMovie = (id, full = false) => tmdb(`/movie/${id}`, { append_to_response: full ? detailParams : 'credits' })

async function enrichResults(results) {
  const movies = []
  for (let i = 0; i < results.length; i += 10) {
    const batch = await Promise.all(results.slice(i, i + 10).map(async raw => {
      try {
        return formatMovie(await rawMovie(raw.id))
      } catch {
        return summary(raw)
      }
    }))
    movies.push(...batch)
  }
  return withRatingsFor(movies, { awards: true })
}

async function completeCard(movie) {
  try {
    const raw = await tmdb(`/movie/${movie.id}`)
    return { ...movie, imdbId: movie.imdbId || raw.imdb_id, runtime: movie.runtime || raw.runtime }
  } catch {
    return movie
  }
}

async function movieList(results, more, { emit, signal, started, source }) {
  logMetric('movie_results', { source, count: results.length, firstCardsMs: Math.round(performance.now() - started) })
  if (!emit) return { movies: await enrichResults(results), more }

  signal?.throwIfAborted()
  const movies = results.map(summary)
  emit({ type: 'cards', result: { movies, more } })
  return { movies: await withRatingsFor(movies, { completeMovie: completeCard }), more }
}

export async function liveSearch(query, page, emit, signal) {
  const started = performance.now()
  const cleaned = query.trim()
  const explicitYear = cleaned.match(/^(.+?)\s*\((\d{4})\)$/)
  const parameters = { page, include_adult: false }
  let result = await tmdb('/search/movie', { ...parameters, query: explicitYear?.[1].trim() || cleaned, year: explicitYear?.[2] }, 10 * 60_000)
  const trailingYear = !explicitYear && cleaned.match(/^(.+?)\s+(\d{4})$/)
  if (trailingYear && !result.total_results) {
    result = await tmdb('/search/movie', { ...parameters, query: trailingYear[1], year: trailingYear[2] }, 10 * 60_000)
  }
  const more = page < Math.min(result.total_pages, 500)
  return movieList(result.results, more, { emit, signal, started, source: 'search' })
}

export async function liveTrending(emit, signal) {
  const started = performance.now()
  const result = await tmdb('/trending/movie/week')
  return movieList(result.results.filter(movie => !movie.adult).slice(0, 10), false, { emit, signal, started, source: 'trending' })
}

export async function liveDetails(id) {
  const raw = await rawMovie(id, true)
  const related = [...(raw.recommendations?.results || []), ...(raw.similar?.results || [])]
  const distinct = [...new Map(related.filter(movie => !movie.adult && movie.id !== id).map(movie => [movie.id, movie])).values()]
  const [movie, similar] = await Promise.all([withRatings(formatMovie(raw, true)), enrichResults(distinct.slice(0, 7))])
  return { ...movie, similar }
}

export async function resolveFilm(candidate, signal) {
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
  const original = typeof candidate.originalTitle === 'string' ? candidate.originalTitle.trim() : ''
  const year = candidate.year
  if (!title || title.length > 180 || !Number.isInteger(year) || year < 1880 || year > new Date().getFullYear() + 3) return null

  const titles = [title, original].filter(name => name && name.length <= 180)
  const names = new Set(titles.map(normalize))
  const exactTitle = raw => !raw.adult && [raw.title, raw.original_title].some(name => name && names.has(normalize(name)))
  for (const query of [...new Set(titles)]) {
    signal?.throwIfAborted()
    const direct = await tmdb('/search/movie', { query, year, include_adult: false })
    signal?.throwIfAborted()
    const matches = direct.results.filter(exactTitle)
    let movie = matches.find(raw => yearOf(raw.release_date) === year)
    const adjacent = matches.filter(raw => Math.abs(yearOf(raw.release_date) - year) === 1)
    if (!movie && adjacent.length === 1) movie = adjacent[0]
    if (!movie) {
      const broad = await tmdb('/search/movie', { query, include_adult: false })
      signal?.throwIfAborted()
      movie = broad.results.find(raw => exactTitle(raw) && yearOf(raw.release_date) === year)
    }
    if (movie) {
      const raw = await rawMovie(movie.id)
      return {
        ...formatMovie(raw),
        creditedCast: (raw.credits?.cast || []).map(person => person.name),
        reason: typeof candidate.reason === 'string' ? candidate.reason.trim().slice(0, 420) : ''
      }
    }
  }
  return null
}
