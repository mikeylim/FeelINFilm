import React, { useEffect, useRef, useState } from 'react'
import { Film, Search, X } from 'lucide-react'
import { MovieShelf } from './Movies'
import { api } from './utils'

export function Lookup({ query, onSearch, open }) {
  const [draft, setDraft] = useState(query)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  const input = useRef(null)

  useEffect(() => {
    const abort = new AbortController()
    const path = query ? `films?${new URLSearchParams({ query, page })}` : 'films/trending'
    api(path, { signal: abort.signal }).then(data => {
      setResult(value => ({
        query, page, more: data.more,
        movies: [...new Map([...(page > 1 && value?.query === query ? value.movies : []), ...data.movies]
          .map(movie => [movie.id, movie])).values()]
      }))
    }).catch(error => {
      if (error.name !== 'AbortError') setResult(value => ({ query, page, error: error.message, movies: page > 1 && value?.query === query ? value.movies : [] }))
    })
    return () => abort.abort()
  }, [query, page, retry])

  const current = result?.query === query ? result : null
  const loading = current?.page !== page
  const films = current?.movies || []
  return <div className="content lookup-content">
    <div className="lookup-intro">
      <div className="lookup-mark"><Search size={24} strokeWidth={1.7} /></div>
      <h1>Movie lookup</h1>
      <p>Find a film by title and explore its cast, ratings, awards, and more.</p>
      <form className="lookup-form" onSubmit={event => {
        event.preventDefault()
        const next = draft.trim()
        if (next && next === query && current?.error) {
          setResult(null)
          setPage(1)
          setRetry(value => value + 1)
        } else if (next !== query) onSearch(next)
      }}>
        <Search size={20} strokeWidth={1.75} />
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={120}
          type="search" aria-label="Movie title" placeholder="Search a movie title…" />
        {draft.length > 0 && <button className="icon-button clear-search" type="button" aria-label="Clear search"
          onClick={() => { setDraft(''); onSearch(''); input.current?.focus() }}><X size={16} /></button>}
        <button className="button primary" type="submit">Search</button>
      </form>
    </div>
    {films.length > 0 && <MovieShelf key={query} movies={films} heading={query ? `Results for “${query}”` : 'Trending this week'}
      grid sortEnabled={Boolean(query)} open={open} eager />}
    {loading && <div className="lookup-loading" role="status">{query ? 'Looking up films…' : 'Loading trending films…'}</div>}
    {query && current?.more && !loading && <button className="button secondary load-more" onClick={() => setPage(value => value + 1)}>Load more films</button>}
    {current?.error && <div className="empty-state" role="alert"><p>{current.error}</p><button className="button secondary" onClick={() => {
      setResult(value => value ? { ...value, page: page - 1, error: '' } : value)
      setRetry(value => value + 1)
    }}>Try again</button></div>}
    {query && !loading && !current?.error && !films.length && <div className="empty-state">
      <Film size={26} /><h2>No films found</h2><p>Check the spelling or try a shorter title.</p>
    </div>}
  </div>
}
