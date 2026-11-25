import { cacheFor, cachedValue, providerJson } from './upstream.js'

const omdbKey = process.env.OMDB_API_KEY?.trim()
const mdblistKey = process.env.MDBLIST_API_KEY?.trim()
const ratingTTL = 6 * 60 * 60_000

export const ratingProviders = { omdb: Boolean(omdbKey), mdblist: Boolean(mdblistKey) }

function decimal(value, max, minimum = 0) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum && number <= max ? number : null
}

const display = value => value == null ? '' : value.toFixed(1)
const percent = value => value == null ? '' : `${Math.round(value)}%`

function filmLink(raw, domain, pathname) {
  if (typeof raw !== 'string') return ''
  try {
    const url = new URL(raw, `https://${domain}/`)
    if (url.protocol === 'https:' && [domain, `www.${domain}`].includes(url.hostname) && pathname.test(url.pathname)) {
      return `${url.origin}${url.pathname}`
    }
  } catch { /* A source link is optional. */ }
  return ''
}

function getOmdb(imdbId) {
  if (!omdbKey || !/^tt\d{7,}$/.test(imdbId)) return null
  return cacheFor(`omdb:${imdbId}`, ratingTTL, async () => {
    const query = new URLSearchParams({ apikey: omdbKey, i: imdbId })
    const result = await providerJson(`https://www.omdbapi.com/?${query}`, {}, 'OMDb', 2800)
    return result.Response === 'True' ? result : null
  }).catch(() => null)
}

function getMdbListEntries(movies) {
  const entries = new Map()
  if (!mdblistKey) return entries
  const ids = [...new Set(movies.map(movie => movie.id))]
  const missing = []
  for (const id of ids) {
    const hit = cachedValue(`mdblist:${id}`)
    if (hit) entries.set(id, hit.catch(() => null))
    else missing.push(id)
  }
  if (!missing.length) return entries

  const query = new URLSearchParams({ apikey: mdblistKey })
  const base = 'https://api.mdblist.com/tmdb/movie'
  if (missing.length === 1) {
    const [id] = missing
    const load = () => providerJson(`${base}/${id}?${query}`, {}, 'MDBList', 3200)
    entries.set(id, cacheFor(`mdblist:${id}`, ratingTTL, load).catch(() => null))
  } else {
    const batch = providerJson(`${base}?${query}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: missing.map(String) })
    }, 'MDBList', 3200).then(rows => {
      if (!Array.isArray(rows)) throw new Error('Unexpected MDBList batch response')
      return new Map(rows.map(row => [Number(row.ids?.tmdb), row]))
    })
    for (const id of missing) {
      const load = () => batch.then(rows => rows.get(id) || null)
      entries.set(id, cacheFor(`mdblist:${id}`, ratingTTL, load).catch(() => null))
    }
  }
  return entries
}

async function rateMovie(movie, entry, { awards, completeMovie }) {
  const awardLookup = awards && movie.imdbId ? getOmdb(movie.imdbId) : null
  const mdb = await entry
  const sources = new Map((Array.isArray(mdb?.ratings) ? mdb.ratings : []).map(rating => [rating.source, rating]))
  const rt = sources.get('tomatoes')
  const letterboxd = sources.get('letterboxd')
  const mdbImdb = decimal(sources.get('imdb')?.value, 10, 1)
  const mdbTomatometer = decimal(rt?.value, 100)
  const needsOmdb = awards || mdbImdb == null || mdbTomatometer == null
  const imdbId = movie.imdbId || (/^tt\d{7,}$/.test(mdb?.ids?.imdb || '') ? mdb.ids.imdb : '')
  let complete = { ...movie, imdbId, runtime: movie.runtime || decimal(mdb?.runtime, 1440, 1) }
  if (completeMovie && (!complete.runtime || (omdbKey && needsOmdb && !imdbId))) {
    complete = await completeMovie(complete)
  }
  const omdb = needsOmdb ? await (awardLookup || getOmdb(complete.imdbId)) : null
  const omdbRt = omdb?.Ratings?.find(rating => rating.Source === 'Rotten Tomatoes')?.Value
  const tomatometer = mdbTomatometer ?? (/^\d{1,3}%$/.test(omdbRt || '') ? decimal(omdbRt.slice(0, -1), 100) : null)
  const imdb = display(decimal(omdb?.imdbRating, 10, 1) ?? mdbImdb)
  const boxdNormalized = decimal(letterboxd?.score, 100, 10)
  const boxdScore = display(boxdNormalized == null ? null : boxdNormalized / 20)
  return {
    ...complete,
    rtUrl: filmLink(rt?.url, 'rottentomatoes.com', /^\/m\/[^/]+\/?$/),
    letterboxdUrl: filmLink(letterboxd?.url, 'letterboxd.com', /^\/film\/[^/]+\/?$/),
    ratings: {
      imdb,
      rt: percent(tomatometer),
      letterboxd: boxdScore
    },
    awards: typeof omdb?.Awards === 'string' && omdb.Awards !== 'N/A' ? omdb.Awards : ''
  }
}

export async function withRatingsFor(movies, options = {}) {
  const entries = getMdbListEntries(movies)
  return Promise.all(movies.map(movie => rateMovie(movie, entries.get(movie.id), options)))
}

export async function withRatings(movie) {
  const [rated] = await withRatingsFor([movie], { awards: true })
  return rated
}
