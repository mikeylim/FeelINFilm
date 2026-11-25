import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { readStorage, saveStorage } from './utils'

const WatchlistContext = createContext(null)

function readFilms(key) {
  const saved = readStorage(key, [])
  if (!Array.isArray(saved)) return []
  const valid = saved.filter(movie => Number.isSafeInteger(movie?.id) && typeof movie.title === 'string')
  return [...new Map(valid.map(movie => [movie.id, movie])).values()]
}

function filmCard(movie, existing = {}) {
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

function useLocalValue(key, read) {
  const [value, setValue] = useState(() => read(key))

  useEffect(() => {
    saveStorage(key, value)
  }, [key, value])

  useEffect(() => {
    function sync(event) {
      if (event.key === null || event.key === `feelinfilm.${key}`) setValue(read(key))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key, read])

  return [value, setValue]
}

function useFilmList(key) {
  const [movies, setMovies] = useLocalValue(key, readFilms)

  const toggle = useCallback(movie => {
    setMovies(current => current.some(item => item.id === movie.id)
      ? current.filter(item => item.id !== movie.id)
      : [filmCard(movie), ...current])
  }, [setMovies])

  const refresh = useCallback(byId => {
    setMovies(current => {
      let changed = false
      const next = current.map(movie => {
        const update = byId.get(movie.id)
        if (!update) return movie
        const updated = filmCard(update, movie)
        if (JSON.stringify(movie) === JSON.stringify(updated)) return movie
        changed = true
        return updated
      })
      return changed ? next : current
    })
  }, [setMovies])

  return { movies, toggle, refresh }
}

const readExcludeWatched = key => readStorage(key, true) !== false

export function WatchlistProvider({ children }) {
  const { movies, toggle, refresh: refreshSaved } = useFilmList('watchlist')
  const { movies: watchedMovies, toggle: toggleWatched, refresh: refreshWatched } = useFilmList('watched')
  const [excludeWatched, setExcludeWatched] = useLocalValue('excludeWatched', readExcludeWatched)

  const refresh = useCallback(updates => {
    const byId = new Map(updates.map(movie => [movie.id, movie]))
    refreshSaved(byId)
    refreshWatched(byId)
  }, [refreshSaved, refreshWatched])

  const savedIds = new Set(movies.map(movie => movie.id))
  const watchedIds = new Set(watchedMovies.map(movie => movie.id))
  return <WatchlistContext.Provider value={{
    movies, savedIds, toggle, watchedMovies, watchedIds, toggleWatched, excludeWatched, setExcludeWatched, refresh
  }}>{children}</WatchlistContext.Provider>
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
