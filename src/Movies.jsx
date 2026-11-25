import React, { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Film, Star } from 'lucide-react'
import { filmPath, languageName, linkOut, movieYear, runtimeText } from './utils'

export function Poster({ movie, className = '', eager = false }) {
  const [failed, setFailed] = useState('')
  const show = movie.poster && failed !== movie.poster
  return <div className={`poster ${className}`}>
    {show ? <img src={movie.poster} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailed(movie.poster)} /> :
      <div className="poster-fallback"><Film size={30} /><span>{movie.title}</span></div>}
  </div>
}

function LetterboxdMark() {
  return <span className="lb-mark" aria-hidden="true"><i /><i /><i /></span>
}

export function Ratings({ movie, detailed = false }) {
  const title = encodeURIComponent(movie.title)
  const imdb = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : `https://www.imdb.com/find/?q=${title}&s=tt`
  const rt = movie.rtUrl || `https://www.rottentomatoes.com/search?search=${title}`
  const letterboxdLink = movie.letterboxdUrl || `https://letterboxd.com/tmdb/${movie.id}/`
  const { imdb: imdbRating, rt: rtRating, letterboxd } = movie.ratings || {}
  const scoreHint = (name, score, snapshot) => score ? `${name} ${score}${snapshot ? ' · Saved score' : ''}` : `Open ${name} to check its rating`
  return <div className={detailed ? 'film-ratings film-ratings-large' : 'film-ratings'}>
    <div className="ratings" aria-label="Film ratings">
      <a href={imdb} {...linkOut} title={scoreHint('IMDb', imdbRating, movie.ratingsSnapshot?.imdb)}
        aria-label={`IMDb for ${movie.title}${imdbRating ? `, ${imdbRating} out of 10` : ''}`}>
        <span className="imdb-mark">IMDb</span><span>{imdbRating ? `${imdbRating}${detailed ? '/10' : ''}` : '—'}</span>
        {detailed && <ArrowUpRight size={14} />}
      </a>
      <a href={rt} {...linkOut} title={scoreHint('Rotten Tomatoes', rtRating, movie.ratingsSnapshot?.rt)}
        aria-label={`Rotten Tomatoes for ${movie.title}${rtRating ? `, ${rtRating}` : ''}`}>
        <span className="rt-mark" aria-hidden="true" /><span>{rtRating || '—'}</span>
        {detailed && <><span className="rating-label tomatometer-label">Tomatometer</span><ArrowUpRight size={14} /></>}
      </a>
      <a href={letterboxdLink} {...linkOut} title={scoreHint('Letterboxd', letterboxd && `${letterboxd}/5`, movie.ratingsSnapshot?.letterboxd)}
        aria-label={`Letterboxd for ${movie.title}${letterboxd ? `, ${letterboxd} out of 5` : ''}`}>
        <LetterboxdMark /><span>{letterboxd ? `${letterboxd}${detailed ? '/5' : ''}` : '—'}</span>
        {detailed && <ArrowUpRight size={14} />}
      </a>
      {detailed && Boolean(movie.vote) && <a href={`https://www.themoviedb.org/movie/${movie.id}`} {...linkOut} title="TMDB community rating">
        <Star size={15} /><span>{movie.vote.toFixed(1)}/10</span><span className="rating-label">TMDB</span><ArrowUpRight size={14} />
      </a>}
    </div>
  </div>
}

export function MovieCard({ movie, open, withReason, eager }) {
  const facts = [movieYear(movie), runtimeText(movie.runtime), movie.genres?.[0] || languageName(movie.language)].filter(Boolean)
  return <article className="movie-card">
    <a className="poster-link" href={filmPath(movie)} onClick={event => open(event, filmPath(movie))} aria-label={`Open ${movie.title}`}>
      <Poster movie={movie} eager={eager} />
    </a>
    <a className="movie-title" href={filmPath(movie)} onClick={event => open(event, filmPath(movie))}>{movie.title}</a>
    {facts.length > 0 && <p className="movie-facts">{facts.join(' · ')}</p>}
    <Ratings movie={movie} />
    {withReason && movie.reason && <p className="movie-reason">{movie.reason}</p>}
  </article>
}

const sortChoices = [
  ['match', 'Best match'], ['imdb', 'Highest IMDb'], ['rt', 'Highest Tomatometer'], ['letterboxd', 'Highest Letterboxd'],
  ['recent', 'Newest release'], ['oldest', 'Oldest release'], ['short', 'Shortest runtime'], ['title', 'Title A–Z']
]
const positive = value => Number.parseFloat(value) || 0
function sortMovies(movies, sort) {
  const compare = {
    imdb: (a, b) => positive(b.ratings?.imdb) - positive(a.ratings?.imdb),
    rt: (a, b) => positive(b.ratings?.rt) - positive(a.ratings?.rt),
    letterboxd: (a, b) => positive(b.ratings?.letterboxd) - positive(a.ratings?.letterboxd),
    recent: (a, b) => (b.date || '').localeCompare(a.date || ''),
    oldest: (a, b) => (a.date || '9999').localeCompare(b.date || '9999'),
    short: (a, b) => (a.runtime || Infinity) - (b.runtime || Infinity),
    title: (a, b) => a.title.localeCompare(b.title)
  }[sort]
  return compare ? [...movies].sort(compare) : movies
}

export function MovieShelf({ movies, open, heading, description, sortEnabled, grid, withReason, eager }) {
  const list = useRef(null)
  const [sort, setSort] = useState('match')
  const [bounds, setBounds] = useState({ previous: false, next: false })
  const ordered = sortMovies(movies, sort)

  useEffect(() => {
    const element = list.current
    if (!element || grid) return
    const update = () => setBounds({
      previous: element.scrollLeft > 4,
      next: element.scrollLeft + element.clientWidth < element.scrollWidth - 4
    })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    element.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', update)
    }
  }, [movies.length, grid])

  const scroll = direction => {
    const element = list.current
    const width = element.firstElementChild?.getBoundingClientRect().width || 170
    const step = width + Number.parseFloat(getComputedStyle(element).columnGap || 0)
    element.scrollBy({ left: direction * step * Math.max(1, Math.floor(element.clientWidth / step) - 1), behavior: 'smooth' })
  }

  if (!movies.length) return null
  return <section className="movie-shelf" aria-label={heading || 'Recommended movies'}>
    <div className="shelf-heading">
      <div>
        {heading && <h2>{heading}</h2>}
        {description && <p>{description}</p>}
      </div>
      <div className="shelf-actions">
        {sortEnabled && movies.length > 1 && <label className="sort-control">
          <span className="sr-only">Sort movies</span>
          <select value={sort} onChange={event => {
            setSort(event.target.value)
            list.current?.scrollTo(0, 0)
          }}>{sortChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <ChevronDown size={14} />
        </label>}
        {!grid && (bounds.previous || bounds.next) && <div className="carousel-controls">
          <button className="icon-button" type="button" onClick={() => scroll(-1)} disabled={!bounds.previous} aria-label="Previous films"><ChevronLeft size={18} /></button>
          <button className="icon-button" type="button" onClick={() => scroll(1)} disabled={!bounds.next} aria-label="More films"><ChevronRight size={18} /></button>
        </div>}
      </div>
    </div>
    <div className={grid ? 'movie-grid' : 'movie-carousel'} ref={list}>
      {ordered.map((movie, index) => <MovieCard key={movie.id} movie={movie} open={open}
        withReason={withReason} eager={eager && index < 5} />)}
    </div>
  </section>
}
