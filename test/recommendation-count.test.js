import assert from 'node:assert/strict'
import test from 'node:test'

process.env.GEMINI_API_KEY = 'gemini-test-key'
process.env.TMDB_READ_ACCESS_TOKEN = 'tmdb-test-token'
delete process.env.MDBLIST_API_KEY
delete process.env.OMDB_API_KEY

const { liveRecommendations } = await import('../server/recommendations.js')

let nextId = 1
function mockRecommendations(t, fields, runtime = () => 100) {
  const movies = Array.from({ length: 12 }, (_, index) => {
    const id = nextId++
    return { id, title: `Test film ${id}`, release_date: '1994-01-01', runtime: runtime(index), genres: [] }
  })
  const searches = []
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input)
    if (url.hostname === 'generativelanguage.googleapis.com') {
      const { generationConfig } = JSON.parse(options.body)
      assert.equal(generationConfig.responseJsonSchema.properties.movies.maxItems, 12)
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        text: 'These films fit your request.',
        followUps: [],
        filters: {},
        movies: movies.map(({ title }) => ({ title, year: 1994, reason: 'A match.' })),
        ...fields
      }) }] } }] })
    }
    assert.equal(url.hostname, 'api.themoviedb.org')
    if (url.pathname === '/3/search/movie') {
      const title = url.searchParams.get('query')
      searches.push(title)
      return Response.json({ results: movies.filter(movie => movie.title === title) })
    }
    return Response.json(movies.find(movie => url.pathname === '/3/movie/' + movie.id))
  })
  return { movies, searches }
}

const ask = text => [{ role: 'user', text }]

for (const { prompt, fields, total } of [
  { prompt: 'I want a quick shortlist of cozy movies.', fields: { count: 3 }, total: 3 },
  { prompt: 'Recommend some thrillers.', fields: { count: 5 }, total: 5 },
  { prompt: 'Recommend movies like 1917.', fields: {}, total: 6 },
  { prompt: 'I want 8.5+ IMDb recommendations.', fields: { count: 5 }, total: 5 },
  { prompt: 'Make a long list of mystery films.', fields: { count: 8 }, total: 8 },
  { prompt: 'Pick one movie to watch tonight.', fields: { count: 4, requestedCount: 1 }, total: 1 },
  { prompt: 'Give me ten essential ’90s thrillers.', fields: { count: 5 }, total: 10 },
  { prompt: 'Give me 20 thrillers.', fields: { count: 6, requestedCount: 20 }, total: 10 }
]) {
  test(prompt, async t => {
    const { movies, searches } = mockRecommendations(t, fields)
    const events = []
    const reply = await liveRecommendations(ask(prompt), [], event => events.push(event))
    const expected = movies.slice(0, total).map(movie => movie.id)
    assert.deepEqual(reply.movies.map(movie => movie.id), expected)
    assert.deepEqual(events.find(event => event.type === 'cards').result.movies.map(movie => movie.id), expected)
    assert.equal(searches.length, total + 2)
  })
}

test('a shortlist keeps a stated runtime even when Gemini confuses the number with a count', async t => {
  const { movies, searches } = mockRecommendations(t, { count: 6, requestedCount: 90 }, index => index < 4 ? 89 : 90)
  const reply = await liveRecommendations(ask('I need a quick shortlist of cozy movies under 90 minutes.'), [])
  assert.equal(reply.criteria.maxRuntime, 89)
  assert.deepEqual(reply.movies.map(movie => movie.id), movies.slice(0, 4).map(movie => movie.id))
  assert.equal(searches.length, 6)
})

test('More picks retains the runtime filter and excludes suggested and watched films', async t => {
  const { movies } = mockRecommendations(t, { count: 5, filters: { maxRuntime: 180 } }, index => index < 4 ? 85 : 110)
  const reply = await liveRecommendations(ask('Give me more recommendations with the same criteria.'), [movies[0]], undefined, undefined, {
    filters: { maxRuntime: 90 },
    lockFilters: true,
    watchedIds: [movies[1].id]
  })
  assert.deepEqual(reply.criteria, { maxRuntime: 90 })
  assert.deepEqual(reply.movies.map(movie => movie.id), [movies[2].id, movies[3].id])
})
