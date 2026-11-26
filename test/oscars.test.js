import assert from 'node:assert/strict'
import test from 'node:test'

for (const key of ['GEMINI_API_KEY', 'TMDB_READ_ACCESS_TOKEN', 'TMDB_ACCESS_TOKEN', 'TMDB_API_KEY']) {
  delete process.env[key]
}

const { academyWinners, directOscarQuestion, explicitOscarFilters } = await import('../server/oscars.js')
const { liveRecommendations } = await import('../server/recommendations.js')

test('an explicit 2025 question answers from the Academy even after a 2020 exchange', async () => {
  const reply = await liveRecommendations([
    { role: 'user', text: 'Who won Best Picture at the 2020 Oscars?' },
    { role: 'assistant', text: 'Parasite won Best Picture at the 2020 Oscars.' },
    { role: 'user', text: 'who won oscars best picture at 2025' }
  ], [], undefined, undefined, {
    filters: { oscarCeremonyYear: 2020, oscarCategories: ['Best Picture'] },
    watchedIds: [1064213]
  })

  assert.equal(reply.source, 'academy')
  assert.equal(reply.criteria.oscarCeremonyYear, 2025)
  assert.equal(reply.text, 'Anora won Best Picture at the 2025 Oscars.')
  assert.equal(reply.awardSource, 'https://www.oscars.org/oscars/ceremonies/2025')
})

test('direct award questions use the exact ceremony and name acting recipients', async () => {
  const reply = await liveRecommendations([{ role: 'user', text: 'Who won Best Actor at the 2025 Oscars?' }], [])
  assert.equal(reply.text, 'Adrien Brody won Actor in a Leading Role for The Brutalist at the 2025 Oscars.')
  const question = directOscarQuestion('2026 Oscar Best Picture winner')
  assert.equal(academyWinners(question.year, question.key)[0].title, 'One Battle after Another')
})

test('Oscar recommendations honor a bare ceremony year and remain recommendations', () => {
  const prompt = 'Recommend movies that won Oscars for Best Picture in 2025.'
  assert.equal(directOscarQuestion(prompt), null)
  assert.equal(explicitOscarFilters({ oscarCeremonyYear: 2020 }, prompt).oscarCeremonyYear, 2025)
  assert.equal(explicitOscarFilters({}, 'Suggest Oscar-winning films released in 2025.').oscarCeremonyYear, undefined)
})
