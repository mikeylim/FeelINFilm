import React, { useState } from 'react'
import { Bookmark, Eye } from 'lucide-react'
import { MovieShelf } from './Movies'
import { WatchDateDialog } from './WatchDateDialog'
import { useWatchlist } from './WatchlistState'

const savedPath = '/watchlist'
export const watchedPath = '/watchlist?tab=watched'

export function isWatchedPath(path) {
  const [pathname, query] = path.split('?')
  return pathname === savedPath && new URLSearchParams(query).get('tab') === 'watched'
}

export function Watchlist({ watched, open }) {
  const { movies: savedMovies, watchedMovies } = useWatchlist()
  const [editingId, setEditingId] = useState(null)
  const editing = watched && watchedMovies.find(movie => movie.id === editingId)
  const entryDate = watched ? { field: 'markedWatchedAt', label: 'Watched', includeYear: true } : { field: 'savedAt', label: 'Saved' }
  const actionTime = movie => Date.parse(movie[entryDate.field]) || 0
  const movies = [...(watched ? watchedMovies : savedMovies)].sort((a, b) => actionTime(b) - actionTime(a))
  return <div className="content lookup-content">
    <header className="lookup-intro watchlist-intro">
      <div className="lookup-mark">{watched ? <Eye size={24} strokeWidth={1.7} aria-hidden="true" />
        : <Bookmark size={24} strokeWidth={1.7} aria-hidden="true" />}</div>
      <h1>{watched ? 'Watched' : 'Watchlist'}</h1>
      {movies.length > 0 && <p>{movies.length} {movies.length === 1 ? 'film' : 'films'} {watched ? 'marked as watched' : 'saved on this device'}</p>}
      <nav className="watchlist-tabs" aria-label="Your film lists">
        <a href={savedPath} aria-current={!watched ? 'page' : undefined} onClick={event => open(event, savedPath)}>Saved</a>
        <a href={watchedPath} aria-current={watched ? 'page' : undefined} onClick={event => open(event, watchedPath)}>Watched</a>
      </nav>
    </header>
    {movies.length ? <MovieShelf movies={movies} open={open}
      heading={watched ? 'Watched films' : 'Saved films'} defaultOrder={watched ? 'Recently watched' : 'Recently saved'}
      entryDate={entryDate} onEditWatchDate={watched ? setEditingId : undefined} grid sortEnabled eager /> :
      <div className="empty-state">
        <h2>{watched ? 'No watched films yet' : 'Your watchlist is empty'}</h2>
        <p>{watched ? 'Use Already watched on a movie card or detail page.' : 'Save a film from search results, recommendations, or its detail page.'}</p>
        <a className="button secondary" href="/lookup" onClick={event => open(event, '/lookup')}>Explore movies</a>
      </div>}
    {editing && <WatchDateDialog key={editing.id} movie={editing} onClose={() => setEditingId(null)} />}
  </div>
}
