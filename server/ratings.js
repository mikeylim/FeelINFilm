import { cacheFor, providerJson } from './upstream.js'

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

function getMdbList(id) {
  if (!mdblistKey) return null
  return cacheFor(`mdblist:${id}`, ratingTTL, () => {
    const query = new URLSearchParams({ apikey: mdblistKey })
    return providerJson(`https://api.mdblist.com/tmdb/movie/${id}?${query}`, {}, 'MDBList', 3200)
  }).catch(() => null)
}

export async function withRatings(movie) {
  const [omdb, mdb] = await Promise.all([getOmdb(movie.imdbId), getMdbList(movie.id)])
  const sources = new Map((Array.isArray(mdb?.ratings) ? mdb.ratings : []).map(rating => [rating.source, rating]))
  const omdbRt = omdb?.Ratings?.find(rating => rating.Source === 'Rotten Tomatoes')?.Value
  const rt = sources.get('tomatoes')
  const letterboxd = sources.get('letterboxd')
  const tomatometer = decimal(rt?.value, 100) ?? (/^\d{1,3}%$/.test(omdbRt || '') ? decimal(omdbRt.slice(0, -1), 100) : null)
  const imdb = display(decimal(omdb?.imdbRating, 10, 1) ?? decimal(sources.get('imdb')?.value, 10, 1))
  const boxdNormalized = decimal(letterboxd?.score, 100, 10)
  const boxdScore = display(boxdNormalized == null ? null : boxdNormalized / 20)
  return {
    ...movie,
    imdbId: movie.imdbId || (/^tt\d{7,}$/.test(mdb?.ids?.imdb || '') ? mdb.ids.imdb : ''),
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
