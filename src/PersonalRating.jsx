import React, { useId, useRef, useState } from 'react'
import { Star, X } from 'lucide-react'
import { locales } from '../shared/locale.js'
import { useLanguage } from './Language'
import { isStarRating, maxStarRating, movieTitle, starRatingStep } from './utils'
import { useWatchlist } from './WatchlistState'

const stars = Array.from({ length: maxStarRating }, (_, index) => index + 1)
const ratingFormats = Object.fromEntries(Object.keys(locales).map(locale => [locale,
  new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
]))

export function PersonalRatingEditor({ movie, rating }) {
  const { locale, t } = useLanguage()
  const { setStarRating } = useWatchlist()
  const name = useId()
  const choices = useRef(null)
  const [preview, setPreview] = useState(null)
  const rated = isStarRating(rating)
  const current = preview ?? (rated ? rating : 0)
  const { format } = ratingFormats[locale]

  function clear() {
    choices.current?.querySelector('input:checked')?.focus()
    setPreview(null)
    setStarRating(movie, undefined)
  }

  return <div className="personal-rating-editor">
    <div className="personal-rating-label" aria-hidden="true">
      {t('Your rating')} <strong>{current ? format(current) : ''}</strong>
    </div>
    <div className="personal-rating-controls">
      <div className="personal-rating-stars" ref={choices} role="radiogroup" aria-label={t('Your rating')} onPointerLeave={() => setPreview(null)}>
        {stars.map(star => <div className="personal-rating-star" key={star}>
          <span className="personal-rating-star-icon" aria-hidden="true">
            <Star size={25} />
            {current > star - 1 && <Star size={25} fill="currentColor"
              className={`personal-rating-star-fill${current < star ? ' is-half' : ''}`} />}
          </span>
          {[star - starRatingStep, star].map(score => <label className="personal-rating-choice" key={score}
            onPointerEnter={event => { if (event.pointerType === 'mouse') setPreview(score) }}>
            <input className="sr-only" type="radio" name={name} value={score}
              aria-label={t('{score} out of {max}', { score: format(score), max: maxStarRating })}
              checked={rating === score} onChange={() => { setPreview(null); setStarRating(movie, score) }} />
          </label>)}
        </div>)}
      </div>
      {rated && <button type="button" className="icon-button personal-rating-clear" aria-label={t('Clear rating')}
        title={t('Clear rating')} onClick={clear}><X size={16} aria-hidden="true" /></button>}
    </div>
  </div>
}

export function PersonalRatingSummary({ movie, showLabel }) {
  const { locale, t } = useLanguage()
  const { watchedById } = useWatchlist()
  const rating = watchedById.get(movie.id)?.starRating
  if (!isStarRating(rating)) return null
  const score = ratingFormats[locale].format(rating)
  return <span className="personal-rating-summary">
    <Star size={14} fill="currentColor" aria-hidden="true" />
    <span aria-hidden="true">{score}</span>
    {showLabel && <span className="personal-rating-caption" aria-hidden="true">{t('Your rating')}</span>}
    <span className="sr-only">{t('Your rating for {title}, {score}', {
      title: movieTitle(movie, locale), score: t('{score} out of {max}', { score, max: maxStarRating })
    })}</span>
  </span>
}
