import winnerRows from './data/oscar-winners.json' with { type: 'json' }
import { normalize } from './providers.js'

// The Academy archive uses distinct page years for ceremonies held in the same calendar year.
const earlyCeremonyYears = [0, 1929, 1930, 1930, 1931, 1932]
const ceremonyYear = ceremony => earlyCeremonyYears[ceremony] || ceremony + 1928
const ceremonyLink = ceremony => `https://www.oscars.org/oscars/ceremonies/${ceremony + 1928}`

const aliases = new Map([
  ['motion picture', 'picture'], ['outstanding picture', 'picture'],
  ['director', 'directing'], ['actor', 'actor in a leading role'], ['actress', 'actress in a leading role'],
  ['lead actor', 'actor in a leading role'], ['leading actor', 'actor in a leading role'],
  ['lead actress', 'actress in a leading role'], ['leading actress', 'actress in a leading role'],
  ['supporting actor', 'actor in a supporting role'], ['supporting actress', 'actress in a supporting role'],
  ['animated feature', 'animated feature film'], ['animation', 'animated feature film'],
  ['international feature', 'international feature film'], ['foreign language film', 'international feature film'],
  ['documentary', 'documentary feature'], ['documentary feature film', 'documentary feature'],
  ['documentary short', 'documentary short subject'], ['documentary short film', 'documentary short subject'],
  ['animated short', 'short film animated'], ['animated short film', 'short film animated'],
  ['live action short', 'short film live action'], ['live action short film', 'short film live action'],
  ['editing', 'film editing'], ['makeup', 'makeup and hairstyling'],
  ['art direction', 'production design'], ['original score', 'music original score'],
  ['original song', 'music original song'], ['original screenplay', 'writing original screenplay'],
  ['adapted screenplay', 'writing adapted screenplay'], ['special effects', 'visual effects'],
  ['sound recording', 'sound']
])

function categoryKey(name) {
  const normalized = normalize(name).replace(/^best /, '')
  return aliases.get(normalized) || normalized
}

function categoryKeys(category, group) {
  const keys = new Set([categoryKey(category), categoryKey(group)])
  const key = categoryKey(group)
  if (/^(actor|actress) in a /.test(key)) keys.add('acting')
  if (key === 'sound editing' || key === 'sound mixing') keys.add('sound')
  const historical = /^(art direction|cinematography|costume design|directing) (?:black and white|color|comedy picture|dramatic picture)$/.exec(key)
  if (historical) keys.add(categoryKey(historical[1]))
  return keys
}

const byFilm = new Map()
const byYear = new Map()
const knownCategories = new Set()
const ceremoniesByYear = new Map()
for (const [imdbId, ceremony, category, title, recipients, group = category] of winnerRows) {
  const year = ceremonyYear(ceremony)
  const source = ceremonyLink(ceremony)
  const keys = categoryKeys(category, group)
  const win = { imdbId, title, recipients, ceremony, year, category, source, keys }
  const wins = byFilm.get(imdbId) || []
  wins.push(win)
  byFilm.set(imdbId, wins)
  const yearWins = byYear.get(year) || []
  yearWins.push(win)
  byYear.set(year, yearWins)
  for (const key of keys) knownCategories.add(key)
  const ceremonies = ceremoniesByYear.get(year) || new Set()
  ceremonies.add(ceremony)
  ceremoniesByYear.set(year, ceremonies)
}

export const latestOscarYear = Math.max(...ceremoniesByYear.keys())

export function academySource(year) {
  const ceremonies = ceremoniesByYear.get(year)
  if (!ceremonies) return ''
  return ceremonies.size === 1 ? ceremonyLink([...ceremonies][0]) : 'https://awardsdatabase.oscars.org/'
}

export function requestsOscarWins(filters) {
  return Boolean(filters.oscarWinner || filters.oscarCeremonyYear || filters.oscarStartYear ||
    filters.oscarEndYear || filters.oscarCategories?.length)
}

export function directOscarQuestion(prompt) {
  const text = normalize(prompt)
  const question = /^(?:who|what|which (?:films?|movies?|titles?)) won (.+)$/.exec(text)
  const body = question?.[1] || (/\bwinners?\b/.test(text)
    ? text.replace(/^(?:what|who) (?:was|is) /, '').replace(/\bwinners?\b/g, '') : '')
  if (!body) return null
  const years = body.match(/\b\d{4}\b/g)
  if (years?.length !== 1) return null
  const category = body.replace(/\b(?:(?:at|in|of|for) )?(?:the )?\d{4}\b/, '')
    .replace(/\b(?:oscars?|academy awards?|ceremony|please)\b/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^(?:(?:at|in|of|for|the) )+/, '').replace(/(?: (?:at|in|of|for|the))+$/, '')
  const key = categoryKey(category)
  return knownCategories.has(key) ? { year: Number(years[0]), category, key } : null
}

export function academyWinners(year, key) {
  return (byYear.get(year) || []).filter(win => win.keys.has(key))
}

// A clearly named ceremony or common category is authoritative even when the model omits it.
export function explicitOscarFilters(filters, prompt) {
  const text = normalize(prompt)
  if (!/\b(?:oscars?|academy awards?)\b/.test(text) || !/\b(?:won|wins?|winners?|winning)\b/.test(text)) return filters
  const years = new Set([...text.matchAll(/\b(\d{4}) (?:oscars?|academy awards?|ceremony)\b|\b(?:oscars?|academy awards?|ceremony) (?:(?:in|of) )?(\d{4})\b/g)]
    .map(match => Number(match[1] || match[2])))
  const mentionedYears = text.match(/\b\d{4}\b/g)
  if (!years.size && mentionedYears?.length === 1 && /\b(?:at|in|for) (?:the )?\d{4}\b/.test(text) &&
    !/\b(?:released|premiered|release year|came out)\b/.test(text)) {
    years.add(Number(mentionedYears[0]))
  }
  const categories = [...new Set([...text.matchAll(/\bbest (picture|director|supporting actor|supporting actress|(?:actor|actress)(?: in a (?:leading|supporting) role)?|original score|original song|original screenplay|adapted screenplay|animated feature(?: film)?|international feature(?: film)?|cinematography|visual effects)\b/g)]
    .map(match => match[0]))]
  const useNamedCategories = categories.length && !/\b(?:not|except|excluding|nominees?|nominated|nominations?)\b/.test(text) &&
    (categories.length === 1 || !filters.oscarCategories?.length)
  const requestsWinners = /\b(?:(?:oscar|academy award) winning (?:films?|movies?)|(?:films?|movies?) (?:that )?won (?:an? )?(?:oscars?|academy awards?))\b/.test(text)
  if (!years.size && !categories.length && !requestsWinners) return filters
  return {
    ...filters,
    oscarWinner: true,
    ...(years.size === 1 ? { oscarCeremonyYear: [...years][0] } : {}),
    ...(useNamedCategories ? { oscarCategories: categories } : {})
  }
}

export function verifiedOscarWins(imdbId, filters) {
  const { oscarCeremonyYear, oscarStartYear, oscarEndYear, oscarRequireAllCategories } = filters
  const categories = (filters.oscarCategories || []).map(categoryKey)
  const wins = (byFilm.get(imdbId) || []).filter(win => oscarCeremonyYear
    ? win.year === oscarCeremonyYear
    : (!oscarStartYear || win.year >= oscarStartYear) && (!oscarEndYear || win.year <= oscarEndYear))

  if (oscarRequireAllCategories && !categories.every(category => wins.some(win => win.keys.has(category)))) return []
  return wins.filter(win => !categories.length || categories.some(category => win.keys.has(category)))
    .map(({ ceremony, year, category, source }) => ({ ceremony, year, category, source }))
}
