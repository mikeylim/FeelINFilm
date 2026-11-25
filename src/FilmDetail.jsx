import React, { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronLeft, Clapperboard, Play, Trophy, UserRound } from 'lucide-react'
import { MovieShelf, Poster, Ratings } from './Movies'
import { api, languageName, linkOut, movieYear, releaseDate, runtimeText } from './utils'

function money(amount) {
  return amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount) : ''
}

export function FilmDetail({ id, back, open, onSimilar, setTitle }) {
  const [film, setFilm] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const request = new AbortController()
    api(`films/${id}`, { signal: request.signal }).then(movie => {
      setFilm(movie)
      setTitle(movie.title)
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message)
    })
    return () => request.abort()
  }, [id, retry, setTitle])

  const backLink = <a className="back-link" href={back} onClick={event => open(event, back)}><ChevronLeft size={17} /> Back to {back.startsWith('/lookup') ? 'lookup' : 'movie chat'}</a>

  if (!film) return <div className="content detail-content">{backLink}
    <div className="empty-state" role={error ? 'alert' : 'status'}>{error ? <>
      <p>{error}</p><button className="button secondary" onClick={() => { setError(''); setRetry(value => value + 1) }}>Try again</button>
    </> : 'Loading film details…'}</div>
  </div>

  const facts = [movieYear(film), runtimeText(film.runtime), film.certification, languageName(film.language)].filter(Boolean)
  const rows = [
    ['Release date', releaseDate(film.date)], ['Original title', film.titleOriginal],
    ['Director', film.directors?.join(', ')], ['Screenplay', film.writers?.join(', ')],
    ['Spoken languages', film.languages?.length ? film.languages.join(', ') : languageName(film.language)],
    ['Countries', film.countries?.join(', ')], ['Production', film.companies?.join(', ')],
    ['Budget', money(film.budget)], ['Box office', money(film.revenue)]
  ].filter(([, value]) => value)

  return <div className="content detail-content">
    {backLink}
    <section className="detail-hero">
      {film.backdrop && <img className="detail-backdrop" src={film.backdrop} alt="" />}
      <Poster movie={film} className="detail-poster" eager />
      <div className="detail-hero-copy">
        <h1>{film.title}</h1>
        {facts.length > 0 && <p className="detail-meta">{facts.join(' · ')}</p>}
        {film.genres?.length > 0 && <div className="genre-list">{film.genres.map(genre => <span key={genre}>{genre}</span>)}</div>}
        {film.tagline && <p className="tagline">“{film.tagline}”</p>}
        <div className="detail-actions">
          {film.trailer && <a className="button primary" href={film.trailer} {...linkOut}><Play size={15} /> Watch trailer</a>}
          <button className="button detail-secondary" onClick={() => onSimilar(film)}><Clapperboard size={16} /> Ask for similar films</button>
        </div>
      </div>
    </section>
    <section className="detail-section rating-section">
      <h2>Ratings</h2>
      <Ratings movie={film} detailed />
    </section>
    <div className="detail-columns">
      <div>
        <section className="detail-section"><h2>Overview</h2><p>{film.overview || 'An overview is currently unavailable.'}</p></section>
        {film.cast?.length > 0 && <section className="detail-section">
          <h2>Cast</h2>
          <div className="cast-grid">{film.cast.map((person, index) => <article key={`${index}-${person.name}`} className="cast-item">
            <div className="cast-photo">{person.image ? <img src={person.image} alt="" loading="lazy" /> : <UserRound size={20} />}</div>
            <div><h3>{person.name}</h3><p>{person.character}</p></div>
          </article>)}</div>
        </section>}
        <section className="detail-section">
          <h2>Awards</h2>
          <div className="award-box"><Trophy size={19} />
            <div><p>{film.awards || 'An awards summary is currently unavailable.'}</p>
              {film.imdbId && <a href={`https://www.imdb.com/title/${film.imdbId}/awards/`} className="text-link" {...linkOut}>Awards on IMDb <ArrowUpRight size={13} /></a>}</div>
          </div>
        </section>
      </div>
      <section className="detail-section film-facts"><h2>Film details</h2><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <a className="text-link" href={`https://www.themoviedb.org/movie/${film.id}`} {...linkOut}>View on TMDB <ArrowUpRight size={14} /></a>
      </section>
    </div>
    <MovieShelf movies={film.similar || []} heading="You might also like" open={open} />
  </div>
}
