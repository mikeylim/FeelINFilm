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

test('Korean Oscar questions resolve the requested ceremony and category without Gemini', async () => {
  const reply = await liveRecommendations([{ role: 'user', text: '2025년 오스카 작품상 수상작은?' }], [], undefined, undefined, { locale: 'ko' })
  assert.equal(reply.source, 'academy')
  assert.equal(reply.locale, 'ko')
  assert.equal(reply.criteria.oscarCeremonyYear, 2025)
  assert.equal(reply.text, '2025년 아카데미 시상식 작품상 수상작은 《Anora》입니다.')
  assert.equal(reply.awardSource, 'https://www.oscars.org/oscars/ceremonies/2025')
  assert.deepEqual(explicitOscarFilters({ oscarCeremonyYear: 2025 }, '2020년 아카데미 수상작 몇 편을 추천해 줘.'), {
    oscarWinner: true, oscarCeremonyYear: 2020
  })
  assert.equal(explicitOscarFilters({}, '2025년에 개봉한 오스카 수상작을 추천해 줘.').oscarCeremonyYear, undefined)
})

test('French Oscar queries distinguish awards, release years, and recommendations', async () => {
  const prompt = 'Quel film a remporté l’Oscar du meilleur film en 2025 ?'
  const reply = await liveRecommendations([{ role: 'user', text: prompt }], [], undefined, undefined, { locale: 'fr' })
  assert.equal(reply.source, 'academy')
  assert.equal(reply.locale, 'fr')
  assert.match(reply.text, /Oscars 2025.*Meilleur film.*Anora/)
  assert.equal(directOscarQuestion('Qui a reçu l’Oscar de la meilleure actrice dans un second rôle en 2025 ?').key,
    'actress in a supporting role')
  const recommendation = 'Recommande-moi quelques films récompensés aux Oscars en 2020.'
  assert.equal(directOscarQuestion(recommendation), null)
  assert.deepEqual(explicitOscarFilters({ oscarCeremonyYear: 2025 }, recommendation), { oscarWinner: true, oscarCeremonyYear: 2020 })
  assert.deepEqual(explicitOscarFilters({}, 'Propose des films oscarisés sortis en 2025.'), { oscarWinner: true })
})
