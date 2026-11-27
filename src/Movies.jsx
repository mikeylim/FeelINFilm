import React, { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, Film, Trophy } from 'lucide-react'
import { awardLabel, genreLabel, locales } from '../shared/locale.js'
import { useLanguage } from './Language'
import { PersonalRatingSummary } from './PersonalRating'
import { filmPath, isStarRating, languageName, linkOut, movieTitle, movieYear, parseCalendarDate, runtimeText } from './utils'
import { WatchDateDialog } from './WatchDateDialog'
import { useWatchlist } from './WatchlistState'

export function Poster({ movie, className = '', eager = false }) {
  const { locale } = useLanguage()
  const [failed, setFailed] = useState('')
  const show = movie.poster && failed !== movie.poster
  return <div className={`poster ${className}`}>
    {show ? <img src={movie.poster} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailed(movie.poster)} /> :
      <div className="poster-fallback"><Film size={30} /><span>{movieTitle(movie, locale)}</span></div>}
  </div>
}

function LetterboxdMark() {
  return <span className="lb-mark" aria-hidden="true"><i /><i /><i /></span>
}

export function Ratings({ movie, detailed = false }) {
  const { locale, t } = useLanguage()
  const title = movieTitle(movie, locale)
  const query = encodeURIComponent(movieTitle(movie, 'en'))
  const imdb = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : `https://www.imdb.com/find/?q=${query}&s=tt`
  const rt = movie.rtUrl || `https://www.rottentomatoes.com/search?search=${query}`
  const letterboxdLink = movie.letterboxdUrl || `https://letterboxd.com/tmdb/${movie.id}/`
  const formatScore = value => locale === 'fr' && value ? String(value).replace('.', ',').replace('%', '\u00a0%') : value
  const imdbRating = formatScore(movie.ratings?.imdb)
  const rtRating = formatScore(movie.ratings?.rt)
  const letterboxd = formatScore(movie.ratings?.letterboxd)
  const scoreHint = (name, score, snapshot) => score ? `${name} ${score}${snapshot ? ` · ${t('Saved score')}` : ''}`
    : t('Open {name} to check its rating', { name })
  const scoreLabel = (name, score) => t(score ? '{name} for {title}, {score}' : '{name} for {title}', { name, title, score })
  return <div className={detailed ? 'film-ratings film-ratings-large' : 'film-ratings'}>
    <div className="ratings" aria-label={t('Film ratings')}>
      <a href={imdb} {...linkOut} title={scoreHint('IMDb', imdbRating, movie.ratingsSnapshot?.imdb)}
        aria-label={scoreLabel('IMDb', imdbRating && t('{score} out of {max}', { score: imdbRating, max: 10 }))}>
        <span className="imdb-mark">IMDb</span><span>{imdbRating ? `${imdbRating}${detailed ? '/10' : ''}` : '—'}</span>
        {detailed && <ArrowUpRight size={14} />}
      </a>
      <a href={rt} {...linkOut} title={scoreHint('Rotten Tomatoes', rtRating, movie.ratingsSnapshot?.rt)}
        aria-label={scoreLabel('Rotten Tomatoes', rtRating)}>
        <span className="rt-mark" aria-hidden="true" /><span>{rtRating || '—'}</span>
        {detailed && <><span className="rating-label tomatometer-label">{t('Tomatometer')}</span><ArrowUpRight size={14} /></>}
      </a>
      <a href={letterboxdLink} {...linkOut} title={scoreHint('Letterboxd', letterboxd && `${letterboxd}/5`, movie.ratingsSnapshot?.letterboxd)}
        aria-label={scoreLabel('Letterboxd', letterboxd && t('{score} out of {max}', { score: letterboxd, max: 5 }))}>
        <LetterboxdMark /><span>{letterboxd ? `${letterboxd}${detailed ? '/5' : ''}` : '—'}</span>
        {detailed && <ArrowUpRight size={14} />}
      </a>
      {detailed && Boolean(movie.vote) && <a href={`https://www.themoviedb.org/movie/${movie.id}`} {...linkOut} title={t('TMDB community rating')}>
        <span className="rating-label">TMDB</span><span>{formatScore(movie.vote.toFixed(1))}/10</span><ArrowUpRight size={14} />
      </a>}
    </div>
  </div>
}

export function WatchlistButton({ movie, overlay = false }) {
  const { locale, t } = useLanguage()
  const { savedIds, toggle } = useWatchlist()
  const saved = savedIds.has(movie.id)
  const action = t(saved ? 'Remove {title} from watchlist' : 'Save {title} to watchlist', { title: movieTitle(movie, locale) })
  const style = overlay ? 'movie-save' : 'button detail-secondary watchlist-action'
  return <button type="button" className={`${style}${saved ? ' is-saved' : ''}`} aria-label={action} title={action}
    onClick={() => toggle(movie)}>
    <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
    {!overlay && t(saved ? 'In watchlist' : 'Save to watchlist')}
  </button>
}

export function WatchedButton({ movie, overlay = false, removeDirectly = false }) {
  const { locale, t } = useLanguage()
  const { watchedById, toggleWatched } = useWatchlist()
  const [editor, setEditor] = useState(null)
  const entry = watchedById.get(movie.id)
  const watched = Boolean(entry)
  const Icon = watched ? Check : Eye
  const style = overlay ? 'movie-save' : 'button detail-secondary watchlist-action'
  const title = movieTitle(movie, locale)
  const action = t(watched ? (removeDirectly ? 'Remove {title} from watched films' : 'Edit watched date for {title}')
    : 'Mark {title} as watched', { title })
  function handleClick() {
    if (!watched || removeDirectly) toggleWatched(movie)
    if (!removeDirectly) setEditor(watched ? 'edit' : 'new')
  }
  return <>
    <button type="button" className={`${style}${watched ? ' is-saved' : ''}`}
      aria-label={t('Already watched {title}', { title })} aria-pressed={watched}
      aria-haspopup={removeDirectly ? undefined : 'dialog'} title={action} onClick={handleClick}>
      <Icon size={16} aria-hidden="true" />
      {!overlay && t('Already watched')}
    </button>
    {editor && entry && <WatchDateDialog movie={entry} onClose={() => setEditor(null)}
      newlyMarked={editor === 'new'} allowRemove={editor === 'edit'} />}
  </>
}

function OscarWins({ wins }) {
  const { locale, t } = useLanguage()
  const ceremonies = new Map()
  for (const win of wins) {
    if (!ceremonies.has(win.ceremony)) ceremonies.set(win.ceremony, { ...win, categories: [] })
    ceremonies.get(win.ceremony).categories.push(win.category)
  }
  return <div className="movie-awards" aria-label={t('Verified Academy Award wins')}>
    {[...ceremonies.values()].map(({ ceremony, year, source, categories }) => <a key={ceremony} href={source} {...linkOut}>
      <Trophy size={14} aria-hidden="true" />
      <span><strong>{t('{year} Oscars', { year })}</strong><span>{categories.map(category => awardLabel(category, locale)).join(' · ')}</span></span>
    </a>)}
  </div>
}

const listDates = Object.fromEntries(Object.keys(locales).map(locale => [locale, {
  short: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
  full: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
  viewing: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
}]))

function formatListDate(timestamp, includeYear, locale) {
  if (typeof timestamp !== 'string') return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const formatter = includeYear || date.getFullYear() !== new Date().getFullYear() ? listDates[locale].full : listDates[locale].short
  return formatter.format(date)
}

function prepareTitleReveal(event) {
  const link = event.currentTarget
  const text = link.firstElementChild
  const overflow = text.scrollWidth - text.clientWidth
  link.toggleAttribute('data-title-overflow', overflow > 0)
  if (overflow <= 0) {
    link.removeAttribute('title')
    return
  }

  const direction = getComputedStyle(text).direction === 'rtl' ? 1 : -1
  link.style.setProperty('--title-offset', `${direction * overflow}px`)
  link.style.setProperty('--title-reveal-duration', `${Math.max(700, overflow * 16)}ms`)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) link.title = text.textContent
  else link.removeAttribute('title')
}

export function MovieCard({ movie, open, withReason, reasonLocale, eager, entryDate, onEditWatchDate }) {
  const { locale, t } = useLanguage()
  const title = movieTitle(movie, locale)
  const facts = [movieYear(movie), runtimeText(movie.runtime, locale), genreLabel(movie.genres?.[0], locale) || languageName(movie.language, locale)].filter(Boolean)
  const timestamp = entryDate && movie[entryDate.field]
  const actionDate = formatListDate(timestamp, entryDate?.includeYear, locale)
  const watchedOn = onEditWatchDate && parseCalendarDate(movie.watchedOn)
  const viewingDate = watchedOn && listDates[locale].viewing.format(watchedOn)
  return <article className="movie-card">
    <div className="poster-frame">
      <a className="poster-link" href={filmPath(movie)} onClick={event => open(event, filmPath(movie))} aria-label={t('Open {title}', { title })}>
        <Poster movie={movie} eager={eager} />
      </a>
      <div className="movie-actions">
        <WatchedButton movie={movie} overlay removeDirectly={Boolean(onEditWatchDate)} />
        <WatchlistButton movie={movie} overlay />
      </div>
    </div>
    <a className="movie-title" href={filmPath(movie)} onClick={event => open(event, filmPath(movie))}
      onPointerEnter={event => { if (event.pointerType !== 'touch') prepareTitleReveal(event) }} onFocus={prepareTitleReveal}>
      <span className="movie-title-text" dir="auto">{title}</span>
    </a>
    <PersonalRatingSummary movie={movie} showLabel={!onEditWatchDate} />
    {facts.length > 0 && <p className="movie-facts">{facts.join(' · ')}</p>}
    {actionDate && <p className="movie-list-date">{t(entryDate.label)} <time dateTime={timestamp}>{actionDate}</time></p>}
    {onEditWatchDate && <button type="button" className="watch-date-button"
      aria-label={t(viewingDate ? 'Watched on {date}. Edit date for {title}' : 'Set date watched for {title}', { date: viewingDate, title })}
      title={viewingDate ? t('Edit date watched') : undefined} onClick={() => onEditWatchDate(movie.id)}>
      <CalendarDays size={14} aria-hidden="true" />
      <span>{viewingDate ? <>{t('Watched on')} <time dateTime={movie.watchedOn}>{viewingDate}</time></> : t('Set date watched')}</span>
    </button>}
    <Ratings movie={movie} />
    {movie.oscarWins?.length > 0 && <OscarWins wins={movie.oscarWins} />}
    {withReason && movie.reason && <p className="movie-reason" lang={reasonLocale}>{movie.reason}</p>}
  </article>
}

const dateOrder = { descending: true, directions: ['Oldest first', 'Newest first'] }
const ratingOrder = { descending: true, directions: ['Low to high', 'High to low'] }
const finiteValue = value => Number.isFinite(value) ? value : null
const dateValue = value => typeof value === 'string' ? finiteValue(Date.parse(value)) : null
const ratingValue = value => finiteValue(Number.parseFloat(value))

const watchedSorts = {
  watchedOn: { label: 'Date watched', ...dateOrder, value: movie => parseCalendarDate(movie.watchedOn)?.getTime() },
  personalRating: { label: 'My rating', ...ratingOrder, value: movie => isStarRating(movie.starRating) ? movie.starRating : null }
}
const commonSorts = {
  imdb: { label: 'IMDb rating', ...ratingOrder, value: movie => ratingValue(movie.ratings?.imdb) },
  rt: { label: 'Tomatometer', ...ratingOrder, value: movie => ratingValue(movie.ratings?.rt) },
  letterboxd: { label: 'Letterboxd rating', ...ratingOrder, value: movie => ratingValue(movie.ratings?.letterboxd) },
  release: { label: 'Release date', ...dateOrder, value: movie => dateValue(movie.date) },
  runtime: { label: 'Runtime', directions: ['Shortest first', 'Longest first'], value: movie => movie.runtime > 0 ? finiteValue(Number(movie.runtime)) : null },
  title: { label: 'Title', directions: ['A–Z', 'Z–A'], value: (movie, locale) => movieTitle(movie, locale) || null }
}

function sortMovies(movies, choice, descending, locale) {
  if (!choice.value) return descending ? [...movies].reverse() : movies

  const direction = descending ? -1 : 1
  return movies.map(movie => ({ movie, value: choice.value(movie, locale) }))
    .sort((a, b) => {
      // Missing values go last in either direction. Equal values keep their input order.
      if (a.value == null) return b.value == null ? 0 : 1
      if (b.value == null) return -1
      const difference = typeof a.value === 'string' ? a.value.localeCompare(b.value, locale) : a.value - b.value
      return direction * difference
    }).map(({ movie }) => movie)
}

export function MovieShelf({ movies, open, heading, description, sortEnabled, grid, withReason, reasonLocale, eager, entryDate, onEditWatchDate, defaultOrder = 'Best match' }) {
  const { locale, t } = useLanguage()
  const list = useRef(null)
  const [sort, setSort] = useState('match')
  const [reversed, setReversed] = useState(false)
  const [bounds, setBounds] = useState({ previous: false, next: false })
  const choices = {
    match: entryDate
      ? { label: defaultOrder, ...dateOrder, value: movie => dateValue(movie[entryDate.field]) }
      : { label: defaultOrder, directions: ['Original order', 'Reverse order'] },
    ...(onEditWatchDate ? watchedSorts : {}),
    ...commonSorts
  }
  const choice = choices[sort]
  const descending = Boolean(choice.descending) !== reversed
  const directionLabel = t(choice.directions[descending ? 1 : 0])
  const DirectionIcon = descending ? ArrowDown : ArrowUp
  const ordered = sort === 'match' && !reversed ? movies : sortMovies(movies, choice, descending, locale)

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
  return <section className="movie-shelf" aria-label={heading || t('Recommended movies')}>
    <div className="shelf-heading">
      <div>
        {heading && <h2>{heading}</h2>}
        {description && <p>{description}</p>}
      </div>
      <div className="shelf-actions">
        {sortEnabled && (movies.length > 1 || entryDate) && <div className="sort-controls">
          <label className="sort-control">
            <span className="sr-only">{t('Sort movies')}</span>
            <select value={sort} onChange={event => {
              setSort(event.target.value)
              setReversed(false)
              list.current?.scrollTo(0, 0)
            }}>{Object.entries(choices).map(([value, { label }]) => <option key={value} value={value}>{t(label)}</option>)}</select>
            <ChevronDown size={14} />
          </label>
          <button className="sort-direction" type="button" aria-label={t('Reverse sort direction ({direction})', { direction: directionLabel })}
            onClick={() => { setReversed(value => !value); list.current?.scrollTo(0, 0) }}>
            <DirectionIcon size={14} aria-hidden="true" /> {directionLabel}
          </button>
        </div>}
        {!grid && (bounds.previous || bounds.next) && <div className="carousel-controls">
          <button className="icon-button" type="button" onClick={() => scroll(-1)} disabled={!bounds.previous} aria-label={t('Previous films')}><ChevronLeft size={18} /></button>
          <button className="icon-button" type="button" onClick={() => scroll(1)} disabled={!bounds.next} aria-label={t('More films')}><ChevronRight size={18} /></button>
        </div>}
      </div>
    </div>
    <div className={grid ? 'movie-grid' : 'movie-carousel'} ref={list}>
      {ordered.map((movie, index) => <MovieCard key={movie.id} movie={movie} open={open}
        withReason={withReason} reasonLocale={reasonLocale} eager={eager && index < 5} entryDate={entryDate} onEditWatchDate={onEditWatchDate} />)}
    </div>
  </section>
}
