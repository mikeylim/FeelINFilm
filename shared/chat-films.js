export const maxChatFilms = 10

export function normalizeChatFilms(value) {
  if (!Array.isArray(value)) return []
  const films = new Map()
  for (const film of value) {
    if (films.size >= maxChatFilms) break
    const id = film?.id
    const title = typeof film?.title === 'string' ? film.title.trim().slice(0, 240) : ''
    if (!Number.isSafeInteger(id) || id <= 0 || films.has(id) || !title) continue
    const { year, runtime } = film
    films.set(id, {
      id, title,
      year: Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : undefined,
      runtime: Number.isSafeInteger(runtime) && runtime > 0 ? runtime : undefined
    })
  }
  return [...films.values()]
}
