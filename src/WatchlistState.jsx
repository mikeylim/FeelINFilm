import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isStarRating, parseCalendarDate, readStorage, saveStorage } from './utils'

const WatchlistContext = createContext(null)

function readFilms(key) {
  const saved = readStorage(key, [])
  if (!Array.isArray(saved)) return []
  const valid = saved.filter(movie => Number.isSafeInteger(movie?.id) && typeof movie.title === 'string')
  const films = [...new Map(valid.map(movie => [movie.id, movie])).values()]
  if (key !== 'watched') return films

  return films.map(movie => {
    if (!Object.hasOwn(movie, 'personalRating')) return movie
    const { personalRating, ...entry } = movie
    const validOldScore = typeof personalRating === 'number' && personalRating >= 0.5 && personalRating <= 10 && Number.isInteger(personalRating * 2)
    // Convert the previous ten-point rating to the nearest half star once.
    return validOldScore && !isStarRating(entry.starRating) ? { ...entry, starRating: Math.round(personalRating) / 2 } : entry
  })
}

function filmCard(movie, existing = {}) {
  return {
    id: movie.id,
    title: movie.title || existing.title,
    titles: { ...(existing.titles || (existing.title ? { en: existing.title } : {})),
      ...(movie.titles || (movie.title ? { en: movie.title } : {})) },
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

function useFilmList(key, timestampKey) {
  const [movies, setMovies] = useLocalValue(key, readFilms)

  const toggle = useCallback(movie => {
    const timestamp = new Date().toISOString()
    setMovies(current => current.some(item => item.id === movie.id)
      ? current.filter(item => item.id !== movie.id)
      : [{ ...filmCard(movie), [timestampKey]: timestamp }, ...current])
  }, [setMovies, timestampKey])

  const refresh = useCallback(byId => {
    setMovies(current => {
      let changed = false
      const next = current.map(movie => {
        const update = byId.get(movie.id)
        if (!update) return movie
        const updated = { ...movie, ...filmCard(update, movie) }
        if (JSON.stringify(movie) === JSON.stringify(updated)) return movie
        changed = true
        return updated
      })
      return changed ? next : current
    })
  }, [setMovies])

  return { movies, setMovies, toggle, refresh }
}

const readExcludeWatched = key => readStorage(key, true) !== false

export function WatchlistProvider({ children }) {
  const { movies, toggle, refresh: refreshSaved } = useFilmList('watchlist', 'savedAt')
  const {
    movies: watchedMovies, setMovies: setWatchedMovies, toggle: toggleWatched, refresh: refreshWatched
  } = useFilmList('watched', 'markedWatchedAt')
  const [excludeWatched, setExcludeWatched] = useLocalValue('excludeWatched', readExcludeWatched)

  const setWatchedOn = useCallback((id, date) => {
    if (date && !parseCalendarDate(date)) return
    const watchedOn = date || undefined
    setWatchedMovies(current => current.map(movie => movie.id === id && movie.watchedOn !== watchedOn
      ? { ...movie, watchedOn } : movie))
  }, [setWatchedMovies])

  const setStarRating = useCallback((movie, starRating) => {
    if (starRating !== undefined && !isStarRating(starRating)) return
    const markedWatchedAt = new Date().toISOString()
    setWatchedMovies(current => {
      const existing = current.find(entry => entry.id === movie.id)
      if (existing?.starRating === starRating) return current
      if (!existing) return [{ ...filmCard(movie), starRating, markedWatchedAt }, ...current]
      return current.map(entry => entry === existing ? { ...entry, starRating } : entry)
    })
  }, [setWatchedMovies])

  const refresh = useCallback(updates => {
    const byId = new Map(updates.map(movie => [movie.id, movie]))
    refreshSaved(byId)
    refreshWatched(byId)
  }, [refreshSaved, refreshWatched])

  const savedIds = new Set(movies.map(movie => movie.id))
  const watchedById = new Map(watchedMovies.map(movie => [movie.id, movie]))
  return <WatchlistContext.Provider value={{
    movies, savedIds, toggle, watchedMovies, watchedById, toggleWatched, setWatchedOn, setStarRating,
    excludeWatched, setExcludeWatched, refresh
  }}>{children}</WatchlistContext.Provider>
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
