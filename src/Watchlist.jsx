import { useLanguage } from './Language'
import React, { useRef, useState } from 'react'
import { Bookmark, Eye, Search, X } from 'lucide-react'
import { MovieShelf } from './Movies'
import { WatchDateDialog } from './WatchDateDialog'
import { movieTitle } from './utils'
import { useWatchlist } from './WatchlistState'

const savedPath = '/watchlist'
export const watchedPath = '/watchlist?tab=watched'

export function isWatchedPath(path) {
  const [pathname, query] = path.split('?')
  return pathname === savedPath && new URLSearchParams(query).get('tab') === 'watched'
}

const searchableTitle = title => title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()

export function Watchlist({ watched, open }) {
  const { locale, t } = useLanguage()
  const { movies: savedMovies, watchedMovies } = useWatchlist()
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const input = useRef(null)
  const editing = watched && watchedMovies.find(movie => movie.id === editingId)
  const entryDate = watched ? { field: 'markedWatchedAt', label: 'Watched status', includeYear: true } : { field: 'savedAt', label: 'Saved' }
  const actionTime = movie => Date.parse(movie[entryDate.field]) || 0
  const movies = watched ? watchedMovies : savedMovies
  const title = searchableTitle(query)
  const matches = movies.filter(movie => !title || [movieTitle(movie, locale), ...Object.values(movie.titles || {})]
    .some(name => typeof name === 'string' && searchableTitle(name).includes(title)))
    .sort((a, b) => actionTime(b) - actionTime(a))
  function clearSearch() {
    setQuery('')
    input.current?.focus()
  }

  return <div className="content lookup-content">
    <header className="lookup-intro watchlist-intro">
      <div className="lookup-mark">{watched ? <Eye size={24} strokeWidth={1.7} aria-hidden="true" />
        : <Bookmark size={24} strokeWidth={1.7} aria-hidden="true" />}</div>
      <h1>{t(watched ? 'Watched' : 'Watchlist')}</h1>
      {movies.length > 0 && <p>{t(watched
        ? (movies.length === 1 ? '{count} film marked as watched' : '{count} films marked as watched')
        : (movies.length === 1 ? '{count} film saved on this device' : '{count} films saved on this device'), { count: movies.length })}</p>}
      <nav className="watchlist-tabs" aria-label={t('Your film lists')}>
        <a href={savedPath} aria-current={!watched ? 'page' : undefined} onClick={event => open(event, savedPath)}>{t('Watchlist tabs saved')}</a>
        <a href={watchedPath} aria-current={watched ? 'page' : undefined} onClick={event => open(event, watchedPath)}>{t('Watched')}</a>
      </nav>
      {movies.length > 0 && <div className="lookup-form" role="search" aria-label={t(watched ? 'Watched films' : 'Watchlist')}>
        <Search size={20} strokeWidth={1.75} aria-hidden="true" />
        <input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)}
          aria-label={t(watched ? 'Search watched films' : 'Search watchlist')} placeholder={t('Filter by title…')} />
        {query && <button className="icon-button clear-search" type="button" aria-label={t('Clear search')} onClick={clearSearch}><X size={16} /></button>}
      </div>}
    </header>
    <MovieShelf movies={matches} open={open}
      heading={t(watched ? 'Watched films' : 'Saved films')} defaultOrder={watched ? 'Recently added' : 'Recently saved'}
      entryDate={entryDate} onEditWatchDate={watched ? setEditingId : undefined} grid sortEnabled eager />
    {movies.length > 0 && !matches.length && <div className="empty-state">
      <h2>{t('No matching films')}</h2>
      <p>{t('Try a different title or clear the search to see your list.')}</p>
      <button className="button secondary" type="button" onClick={clearSearch}>{t('Clear search')}</button>
    </div>}
    {!movies.length &&
      <div className="empty-state">
        <h2>{t(watched ? 'No watched films yet' : 'Your watchlist is empty')}</h2>
        <p>{t(watched ? 'Use Already watched on a movie card or detail page.' : 'Save a film from search results, recommendations, or its detail page.')}</p>
        <a className="button secondary" href="/lookup" onClick={event => open(event, '/lookup')}>{t('Explore movies')}</a>
      </div>}
    {editing && <WatchDateDialog key={editing.id} movie={editing} onClose={() => setEditingId(null)} />}
  </div>
}
