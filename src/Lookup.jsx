import { useLanguage } from './Language'
import React, { useEffect, useRef, useState } from 'react'
import { Film, Search, X } from 'lucide-react'
import { MovieShelf } from './Movies'
import { requestUpdates } from './utils'
import { useWatchlist } from './WatchlistState'

export function Lookup({ query, onSearch, open }) {
  const { locale, t } = useLanguage()
  const [draft, setDraft] = useState(query)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState({})
  const [retry, setRetry] = useState(0)
  const input = useRef(null)
  const { refresh } = useWatchlist()

  useEffect(() => {
    const abort = new AbortController()
    const path = query ? `films?${new URLSearchParams({ query, page })}` : 'films/trending'
    const savePage = (data, enriching) => {
      if (abort.signal.aborted) return
      setPages(current => ({ ...current, [page]: { ...data, enriching } }))
      if (!enriching) refresh(data.movies)
    }
    requestUpdates(path, { signal: abort.signal, locale }, event => {
      if (event.type === 'cards') savePage(event.result, true)
    }).then(data => savePage(data, false)).catch(error => {
      if (abort.signal.aborted) return
      setPages(current => ({
        ...current,
        [page]: { movies: [], ...current[page], error: error.message, enriching: false }
      }))
    })
    return () => abort.abort()
  }, [query, page, retry, refresh, locale])

  const current = pages[page]
  const filmsById = new Map()
  for (const result of Object.values(pages)) {
    for (const movie of result?.movies || []) {
      if (!filmsById.has(movie.id)) filmsById.set(movie.id, movie)
    }
  }
  const films = [...filmsById.values()]

  function retryPage() {
    setPages(previous => ({
      ...previous,
      [page]: current?.movies.length ? { ...current, error: '', enriching: true } : undefined
    }))
    setRetry(value => value + 1)
  }

  return <div className="content lookup-content">
    <div className="lookup-intro">
      <div className="lookup-mark"><Search size={24} strokeWidth={1.7} /></div>
      <h1>{t('Movie lookup')}</h1>
      <p>{t('Find a film by title and explore its cast, ratings, awards, and more.')}</p>
      <form className="lookup-form" onSubmit={event => {
        event.preventDefault()
        const next = draft.trim()
        if (next !== query) onSearch(next)
        else if (current?.error) retryPage()
      }}>
        <Search size={20} strokeWidth={1.75} />
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={120}
          type="search" aria-label={t('Movie title')} placeholder={t('Search a movie title…')} />
        {draft.length > 0 && <button className="icon-button clear-search" type="button" aria-label={t('Clear search')}
          onClick={() => { setDraft(''); onSearch(''); input.current?.focus() }}><X size={16} /></button>}
        <button className="button primary" type="submit">{t('Search')}</button>
      </form>
    </div>
    {films.length > 0 && <MovieShelf key={query} movies={films} heading={query ? t('Results for “{query}”', { query }) : t('Trending this week')}
      grid sortEnabled={Boolean(query)} open={open} eager />}
    {!current && <div className="lookup-loading" role="status">{query ? t('Looking up films…') : t('Loading trending films…')}</div>}
    {current?.enriching && current.movies.length > 0 && <p className="lookup-loading" role="status">{t('Loading film ratings…')}</p>}
    {query && current?.more && !current.enriching && !current.error &&
      <button className="button secondary load-more" onClick={() => setPage(value => value + 1)}>{t('Load more films')}</button>}
    {current?.error && <div className="empty-state" role="alert"><p>{current.error}</p>
      <button className="button secondary" onClick={retryPage}>{t('Try again')}</button></div>}
    {query && current && !current.enriching && !current.error && !films.length && <div className="empty-state">
      <Film size={26} /><h2>{t('No films found')}</h2><p>{t('Check the spelling or try a shorter title.')}</p>
    </div>}
  </div>
}
