import { useLanguage } from './Language'
import React, { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronLeft, Clapperboard, Play, Trophy, UserRound } from 'lucide-react'
import { genreLabel } from '../shared/locale.js'
import { MovieShelf, Poster, Ratings, WatchedButton, WatchlistButton } from './Movies'
import { api, awardsSummary, languageName, linkOut, movieYear, releaseDate, runtimeText } from './utils'
import { useWatchlist } from './WatchlistState'

function money(amount, locale) {
  return amount ? new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount) : ''
}

export function FilmDetail({ id, back, open, onSimilar, setTitle }) {
  const { locale, t } = useLanguage()
  const [film, setFilm] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const { refresh } = useWatchlist()
  useEffect(() => {
    const request = new AbortController()
    api(`films/${id}`, { signal: request.signal, locale }).then(movie => {
      if (request.signal.aborted) return
      setFilm(movie)
      setTitle(movie.title)
      refresh([movie, ...(movie.similar || [])])
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message)
    })
    return () => request.abort()
  }, [id, retry, setTitle, refresh, locale])

  const [backPath, backQuery] = back.split('?')
  const backLabel = backPath === '/lookup' ? 'lookup' : backPath === '/watchlist'
    ? (new URLSearchParams(backQuery).get('tab') === 'watched' ? 'watched films' : 'watchlist') : 'movie chat'
  const backLink = <a className="back-link" href={back} onClick={event => open(event, back)}><ChevronLeft size={17} /> {t(`Back to ${backLabel}`)}</a>

  if (!film) return <div className="content detail-content">{backLink}
    <div className="empty-state" role={error ? 'alert' : 'status'}>{error ? <>
      <p>{error}</p><button className="button secondary" onClick={() => { setError(''); setRetry(value => value + 1) }}>{t('Try again')}</button>
    </> : t('Loading film details…')}</div>
  </div>

  const facts = [movieYear(film), runtimeText(film.runtime, locale), film.certification, languageName(film.language, locale)].filter(Boolean)
  const rows = [
    ['Release date', releaseDate(film.date, locale)], ['Original title', film.titleOriginal],
    ['Director', film.directors?.join(', ')], ['Screenplay', film.writers?.join(', ')],
    ['Spoken languages', film.languageCodes?.length ? film.languageCodes.map(code => languageName(code, locale)).join(', ')
      : film.languages?.join(', ') || languageName(film.language, locale)],
    ['Countries', film.countryCodes?.map(code => new Intl.DisplayNames(locale, { type: 'region' }).of(code)).join(', ') || film.countries?.join(', ')], ['Production', film.companies?.join(', ')],
    ['Budget', money(film.budget, locale)], ['Box office', money(film.revenue, locale)]
  ].filter(([, value]) => value)

  return <div className="content detail-content">
    {backLink}
    <section className="detail-hero">
      {film.backdrop && <img className="detail-backdrop" src={film.backdrop} alt="" />}
      <Poster movie={film} className="detail-poster" eager />
      <div className="detail-hero-copy">
        <h1>{film.title}</h1>
        {facts.length > 0 && <p className="detail-meta">{facts.join(' · ')}</p>}
        {film.genres?.length > 0 && <div className="genre-list">{film.genres.map(genre => <span key={genre}>{genreLabel(genre, locale)}</span>)}</div>}
        {film.tagline && <p className="tagline">“{film.tagline}”</p>}
        <div className="detail-actions">
          {film.trailer && <a className="button primary" href={film.trailer} {...linkOut}><Play size={15} /> {t('Watch trailer')}</a>}
          <WatchlistButton movie={film} />
          <WatchedButton movie={film} />
          <button className="button detail-secondary" onClick={() => onSimilar(film)}><Clapperboard size={16} /> {t('Ask for similar films')}</button>
        </div>
      </div>
    </section>
    <section className="detail-section rating-section">
      <h2>{t('Ratings')}</h2>
      <Ratings movie={film} detailed />
    </section>
    <div className="detail-columns">
      <div>
        <section className="detail-section"><h2>{t('Overview')}</h2><p>{film.overview || t('An overview is currently unavailable.')}</p></section>
        {film.cast?.length > 0 && <section className="detail-section">
          <h2>{t('Cast')}</h2>
          <div className="cast-grid">{film.cast.map((person, index) => <article key={`${index}-${person.name}`} className="cast-item">
            <div className="cast-photo">{person.image ? <img src={person.image} alt="" loading="lazy" /> : <UserRound size={20} />}</div>
            <div><h3>{person.name}</h3><p>{person.character}</p></div>
          </article>)}</div>
        </section>}
        <section className="detail-section">
          <h2>{t('Awards')}</h2>
          <div className="award-box"><Trophy size={19} />
            <div><p>{awardsSummary(film.awards, locale) || t('An awards summary is currently unavailable.')}</p>
              {film.imdbId && <a href={`https://www.imdb.com/title/${film.imdbId}/awards/`} className="text-link" {...linkOut}>{t('Awards on IMDb')} <ArrowUpRight size={13} /></a>}</div>
          </div>
        </section>
      </div>
      <section className="detail-section film-facts"><h2>{t('Film details')}</h2><dl>{rows.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
        <a className="text-link" href={`https://www.themoviedb.org/movie/${film.id}`} {...linkOut}>{t('View on TMDB')} <ArrowUpRight size={14} /></a>
      </section>
    </div>
    <MovieShelf movies={film.similar || []} heading={t('You might also like')} open={open} />
  </div>
}
