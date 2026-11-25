import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { readStorage, saveStorage } from './utils'

const WatchlistContext = createContext(null)

function readWatchlist() {
  const saved = readStorage('watchlist', [])
  if (!Array.isArray(saved)) return []
  const valid = saved.filter(movie => Number.isSafeInteger(movie?.id) && typeof movie.title === 'string')
  return [...new Map(valid.map(movie => [movie.id, movie])).values()]
}

function watchlistCard(movie, existing = {}) {
  return {
    id: movie.id,
    title: movie.title || existing.title,
    date: movie.date || existing.date,
    poster: movie.poster || existing.poster,
    language: movie.language || existing.language,
    genres: movie.genres?.length ? movie.genres : existing.genres,
    runtime: movie.runtime || existing.runtime,
    imdbId: movie.imdbId || existing.imdbId,
    rtUrl: movie.rtUrl || existing.rtUrl,
    letterboxdUrl: movie.letterboxdUrl || existing.letterboxdUrl,
    ratings: {
      imdb: movie.ratings?.imdb || existing.ratings?.imdb,
      rt: movie.ratings?.rt || existing.ratings?.rt,
      letterboxd: movie.ratings?.letterboxd || existing.ratings?.letterboxd
    }
  }
}

export function WatchlistProvider({ children }) {
  const [movies, setMovies] = useState(readWatchlist)

  useEffect(() => {
    saveStorage('watchlist', movies)
  }, [movies])

  useEffect(() => {
    function sync(event) {
      if (event.key === 'feelinfilm.watchlist') setMovies(readWatchlist())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const toggle = useCallback(movie => {
    setMovies(current => current.some(item => item.id === movie.id)
      ? current.filter(item => item.id !== movie.id)
      : [watchlistCard(movie), ...current])
  }, [])

  const refresh = useCallback(updates => {
    const byId = new Map(updates.map(movie => [movie.id, movie]))
    setMovies(current => {
      let changed = false
      const next = current.map(movie => {
        const update = byId.get(movie.id)
        if (!update) return movie
        const updated = watchlistCard(update, movie)
        if (JSON.stringify(movie) === JSON.stringify(updated)) return movie
        changed = true
        return updated
      })
      return changed ? next : current
    })
  }, [])

  const savedIds = new Set(movies.map(movie => movie.id))
  return <WatchlistContext.Provider value={{ movies, savedIds, toggle, refresh }}>{children}</WatchlistContext.Provider>
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
