import { useLanguage } from './Language'
import React, { useId, useState } from 'react'
import { Modal } from './Modal'
import { movieTitle, parseCalendarDate } from './utils'
import { useWatchlist } from './WatchlistState'

export function WatchDateDialog({ movie, onClose, allowRemove = false }) {
  const { locale, t } = useLanguage()
  const { setWatchedOn, toggleWatched } = useWatchlist()
  const inputId = useId()
  const [date, setDate] = useState(() => parseCalendarDate(movie.watchedOn) ? movie.watchedOn : '')
  const valid = Boolean(parseCalendarDate(date))

  function saveDate(value) {
    setWatchedOn(movie.id, value)
    onClose()
  }

  return <Modal title={t('Date watched')} onClose={onClose}>
    <p>{movieTitle(movie, locale)}</p>
    <form className="watch-date-form" onSubmit={event => {
      event.preventDefault()
      if (valid) saveDate(date)
    }}>
      <label htmlFor={inputId}>{t('Viewing date')}</label>
      <input id={inputId} type="date" required value={date} onChange={event => setDate(event.target.value)} />
      <div className="watch-date-actions">
        {movie.watchedOn && <button type="button" className="button secondary clear-watch-date" onClick={() => saveDate('')}>{t('Clear date')}</button>}
        {allowRemove && <button type="button" className="button secondary" onClick={() => {
          toggleWatched(movie)
          onClose()
        }}>{t('Remove from Watched')}</button>}
        <button className="button primary" type="submit" disabled={!valid}>{t('Save date')}</button>
      </div>
    </form>
  </Modal>
}
