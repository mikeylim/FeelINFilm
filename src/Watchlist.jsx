import React from 'react'
import { Bookmark } from 'lucide-react'
import { MovieShelf } from './Movies'
import { useWatchlist } from './WatchlistState'

export function Watchlist({ open }) {
  const { movies } = useWatchlist()
  return <div className="content lookup-content">
    <header className="lookup-intro watchlist-intro">
      <div className="lookup-mark"><Bookmark size={24} strokeWidth={1.7} aria-hidden="true" /></div>
      <h1>Watchlist</h1>
      {movies.length > 0 && <p>{movies.length} {movies.length === 1 ? 'film' : 'films'} saved on this device</p>}
    </header>
    {movies.length ? <MovieShelf movies={movies} open={open} heading="Saved films" defaultOrder="Recently saved" grid sortEnabled eager /> :
      <div className="empty-state">
        <h2>Your watchlist is empty</h2>
        <p>Save a film from search results, recommendations, or its detail page.</p>
        <a className="button secondary" href="/lookup" onClick={event => open(event, '/lookup')}>Explore movies</a>
      </div>}
  </div>
}
