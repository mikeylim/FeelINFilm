import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowUp, Check, Clapperboard, Clock, Coffee, Film, MessageSquarePlus, Mic, MicOff, Plus, Puzzle, Square, Trophy, Video, X
} from 'lucide-react'
import { maxChatFilms } from '../shared/chat-films.js'
import { locales } from '../shared/locale.js'
import { useLanguage } from './Language'
import { FilmGuideIcon } from './FilmGuideIcon'
import { MovieShelf } from './Movies'
import { filmPath, linkOut, movieTitle } from './utils'
import { useWatchlist } from './WatchlistState'

const prompts = [
  [Coffee, 'Cozy night in', 'I’m in the mood for a cozy, feel-good movie. What should I watch?'],
  [Film, 'Similar to Inception', 'I loved Inception. What other movies have mind-bending stories and high stakes?'],
  [Trophy, 'Oscar winners', 'Recommend a few films that won Oscars at the 2020 ceremony.'],
  [Clapperboard, 'Best of the ’90s', 'What are some of the best movies released in the 1990s?'],
  [Puzzle, 'Twisty thrillers', 'Recommend a few suspenseful thrillers with clever twists. Keep the twists a surprise.'],
  [Clock, '90 minutes or less', 'What are some well-reviewed movies that run 90 minutes or less?'],
  [Video, 'Directed by Miyazaki', 'Which movies directed by Hayao Miyazaki should I start with, and why?']
]

function FilmChips({ films, onRemove, open }) {
  const { t } = useLanguage()
  const draftChips = useRef(null)
  const count = useRef(0)
  useEffect(() => {
    const chips = draftChips.current
    if (chips && films.length > count.current) chips.scrollTop = chips.scrollHeight
    count.current = films.length
  }, [films.length])

  return <div className="film-chips" ref={onRemove ? draftChips : undefined} role="group" aria-label={t(onRemove ? 'Selected films' : 'Films in this message')}>
    {films.map(film => {
      const label = film.year ? `${film.title} (${film.year})` : film.title
      const title = <span dir="auto">{label}</span>
      return onRemove ? <button type="button" className="film-chip" key={film.id} title={label}
        aria-label={t('Remove {title} from this message', { title: label })} onClick={event => onRemove(event, film)}>
        <Film size={14} aria-hidden="true" />{title}<X size={14} aria-hidden="true" />
      </button> : <a className="film-chip" title={label} href={filmPath(film)} key={film.id} onClick={event => open(event, filmPath(film))}>
        <Film size={14} aria-hidden="true" />{title}
      </a>
    })}
  </div>
}

function Composer({ draft, setDraft, onSend, stop, busy, onFocusRef, active, selectedFilms, toggleChatFilm }) {
  const { locale, t } = useLanguage()
  const textarea = useRef(null)
  const recognizer = useRef(null)
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const { watchedMovies, excludeWatched, setExcludeWatched } = useWatchlist()
  const submit = () => { if (!busy && draft.trim()) onSend(draft) }
  const placeholder = selectedFilms.length ? 'Ask about the selected films…'
    : active ? 'Ask for more movies or narrow your picks…' : 'Describe a mood, a movie you love, or what you want to watch…'
  useEffect(() => {
    onFocusRef.current = () => textarea.current?.focus()
    return () => {
      onFocusRef.current = null
      const speech = recognizer.current
      if (speech) {
        speech.onend = speech.onerror = speech.onresult = null
        speech.abort()
      }
    }
  }, [onFocusRef])

  useEffect(() => {
    const input = textarea.current
    input.style.height = '0px'
    input.style.height = `${Math.min(input.scrollHeight, 135)}px`
  }, [draft])

  function voice() {
    if (recognizer.current) {
      recognizer.current.stop()
      return
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Speech) {
      setVoiceStatus('Voice input is unavailable in this browser. You can type your request below.')
      return
    }
    const speech = new Speech()
    recognizer.current = speech
    speech.lang = navigator.language?.toLowerCase().startsWith(`${locale}-`) ? navigator.language : locales[locale].speech
    setVoiceStatus('')
    speech.onresult = event => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript
      if (transcript) setDraft(value => [value.trimEnd(), transcript].filter(Boolean).join(' ').slice(0, 1600))
      textarea.current?.focus()
    }
    speech.onerror = event => {
      if (event.error !== 'aborted') setVoiceStatus(event.error === 'not-allowed'
        ? 'Allow microphone access to use voice input.' : 'Voice input wasn’t clear. Try again or type your request.')
    }
    speech.onend = () => {
      recognizer.current = null
      setListening(false)
    }
    try {
      speech.start()
      setListening(true)
    } catch {
      recognizer.current = null
      setVoiceStatus('The microphone couldn’t start. Try again or type your request.')
    }
  }

  return <div className="composer-wrap">
    {voiceStatus && <div className="voice-status" role="status">{t(voiceStatus)}</div>}
    <form className="composer" onSubmit={event => { event.preventDefault(); submit() }}>
      {selectedFilms.length > 0 && <FilmChips films={selectedFilms} onRemove={(event, film) => {
        const button = event.currentTarget
        const next = button.nextElementSibling || button.previousElementSibling || textarea.current
        next?.focus({ preventScroll: next === textarea.current })
        toggleChatFilm(film)
      }} />}
      {selectedFilms.length >= maxChatFilms && <p className="film-chip-limit" role="status">{t('Up to {count} films per message', { count: maxChatFilms })}</p>}
      <label htmlFor="chat-prompt" className="sr-only">{t('Movie request')}</label>
      <textarea ref={textarea} value={draft} id="chat-prompt" maxLength={1600}
        placeholder={t(placeholder)}
        onChange={event => setDraft(event.target.value)} rows={1}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault()
            submit()
          }
        }} />
      <div className="composer-actions">
        {watchedMovies.length > 0 && <label className="watched-filter">
          <input type="checkbox" checked={excludeWatched} onChange={event => setExcludeWatched(event.target.checked)} />
          {t('Exclude watched films')}
        </label>}
        <button type="button" className={listening ? 'icon-button mic listening' : 'icon-button mic'} onClick={voice}
          title={t(listening ? 'Stop listening' : 'Use voice input')} aria-label={t(listening ? 'Stop listening' : 'Use voice input')} aria-pressed={listening}>
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        {busy ? <button type="button" className="send-button" onClick={stop} aria-label={t('Stop reply')} title={t('Stop reply')}><Square size={14} fill="currentColor" /></button> :
          <button type="submit" className="send-button" disabled={!draft.trim()} aria-label={t('Send movie request')} title={t('Send movie request')}><ArrowUp size={20} strokeWidth={2.4} /></button>}
      </div>
    </form>
  </div>
}

const progress = {
  backup: 'Taking another pass at your recommendations',
  matching: 'Verifying film matches',
  ratings: 'Loading film ratings'
}

export function Chat({ thread, pending, draft, setDraft, submit, retry, stop, error, onFocusRef, onMore, open, selectedFilms, toggleChatFilm }) {
  const { locale, t } = useLanguage()
  const savedMessages = thread?.messages || []
  const messages = pending?.reply ? [...savedMessages, pending.reply] : savedMessages
  const busy = Boolean(pending)
  const active = messages.length > 0
  const lastPrompt = useRef(null)
  const lastReply = useRef(null)
  const turnStatus = useRef(null)
  const composerArea = useRef(null)
  const scroll = useRef({ turn: '', busy: false, mode: 'turn', top: 0 })
  const last = messages.at(-1)
  const latestPrompt = savedMessages.findLast(message => message.role === 'user')
  const turn = active ? `${thread?.id}:${latestPrompt?.id || last.id}` : ''

  useEffect(() => {
    if (!active) return
    const state = scroll.current
    const rememberScroll = () => {
      const page = document.scrollingElement
      const top = window.scrollY
      // Ignore scroll events from positioning the latest turn.
      if (Math.abs(top - state.top) < 2) return
      state.top = top
      state.mode = page.scrollHeight - page.clientHeight - top < 48 ? 'bottom' : 'paused'
    }
    window.addEventListener('scroll', rememberScroll, { passive: true })
    return () => window.removeEventListener('scroll', rememberScroll)
  }, [active])

  useEffect(() => {
    const state = scroll.current
    if (state.turn !== turn || (busy && !state.busy)) state.mode = 'turn'
    state.turn = turn
    state.busy = busy
    if (!active || state.mode === 'paused') return

    const frame = requestAnimationFrame(() => {
      if (state.mode === 'paused') return
      if (state.mode === 'bottom') {
        window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' })
      } else {
        const reply = lastReply.current || turnStatus.current
        const anchor = lastPrompt.current || reply
        anchor?.scrollIntoView({ block: 'start', behavior: 'instant' })
        if (reply && reply !== anchor) {
          const bounds = reply.getBoundingClientRect()
          const composerTop = composerArea.current.getBoundingClientRect().top
          if (bounds.top + Math.min(bounds.height, 80) > composerTop) {
            reply.scrollIntoView({ block: 'start', behavior: 'instant' })
          }
        }
      }
      state.top = window.scrollY
    })
    return () => cancelAnimationFrame(frame)
  }, [active, turn, last, busy, pending?.stage, error])

  function renderFilmAction(movie) {
    const selected = selectedFilms.some(film => film.id === movie.id)
    const Icon = selected ? Check : MessageSquarePlus
    const label = t('Add to chat')
    const title = movieTitle(movie, locale)
    return <button type="button" className="film-chat-action" aria-label={`${label} · ${title}`} aria-pressed={selected}
      disabled={!selected && selectedFilms.length >= maxChatFilms} onClick={() => toggleChatFilm(movie)}>
      <Icon size={15} aria-hidden="true" /> {label}
    </button>
  }

  const status = progress[pending?.stage] || (latestPrompt?.films?.length ? 'Looking at the selected films' : 'Curating your film recommendations')
  const composer = <Composer draft={draft} setDraft={setDraft} onSend={submit} stop={stop} busy={busy} onFocusRef={onFocusRef} active={active}
    selectedFilms={selectedFilms} toggleChatFilm={toggleChatFilm} />
  return active ? <div className="content chat-content">
    <h1 className="sr-only">{t('Movie recommendation chat')}</h1>
    <div className="conversation" aria-label={t('Movie conversation')}>
      {messages.map((message, index) => message.role === 'user'
        ? <div className="user-turn" key={message.id} ref={message === latestPrompt ? lastPrompt : undefined}>
          <div className="user-message">
            {message.films?.length > 0 && <FilmChips films={message.films} open={open} />}
            <p>{message.display ? t('Show me more picks') : message.text}</p>
          </div>
        </div>
        : <section className="assistant-turn" key={message.id} ref={index === messages.length - 1 ? lastReply : undefined} aria-label={t('FeelINFilm response')}>
          <div className="assistant-identity" title={message.model}><span><FilmGuideIcon /></span> {t(message.source === 'preview' ? 'Saved preview reply' : 'FeelINFilm')}</div>
          <p className="assistant-copy" lang={message.locale}>{message.text}</p>
          {message.awardSource && <a className="text-link award-source" href={message.awardSource} {...linkOut}>{t('Check the official Academy results')}</a>}
          <MovieShelf movies={message.movies || []} heading={message.movies?.length
            ? (t(message.source === 'academy' ? 'Oscar results' : 'Your recommendations')) : ''}
            sortEnabled withReason reasonLocale={message.locale} eager={index === messages.length - 1} open={open} renderFilmAction={renderFilmAction} />
          {message === pending?.reply && <p className="chat-progress" role="status">
            {t(pending.stage === 'ratings' ? 'Loading film ratings…' : 'Verifying more film matches…')}
          </p>}
          {index === messages.length - 1 && !busy && !selectedFilms.length && message.source !== 'academy' && ((message.movies?.length || 0) > 0 || message.followUps?.length > 0) &&
            <div className="followups">
              {message.movies?.length > 0 && <button className="prompt-chip more-picks" onClick={onMore}><Plus size={16} /> {t('More picks')}</button>}
              {message.followUps?.map((text, index) => <button key={`${index}-${text}`} className="prompt-chip" lang={message.locale} onClick={() => submit(text)}>{text}</button>)}
            </div>}
        </section>)}
      {busy && !pending.reply && <div ref={turnStatus} className="assistant-identity thinking" role="status"><span><FilmGuideIcon /></span> {t(status)}<span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
      {error && <div ref={turnStatus} className="chat-error" role="alert"><p>{error}</p><button className="button secondary" onClick={retry}>{t('Try again')}</button></div>}
    </div>
    <div className="sticky-composer" ref={composerArea}>{composer}</div>
  </div> : <div className="content home-content">
    <section className="hero">
      <div className="hero-copy">
        <h1>{t('What are you in')}<br /><em>{t('the mood for?')}</em></h1>
        <p>{t('Tell us how you’re feeling, what you love, or what you’re curious about. Find a film that fits.')}</p>
      </div>
    </section>
    <div className="home-composer">
      {composer}
      <div className="prompt-list" aria-label={t('Try a movie prompt')}>
        {prompts.map(([Icon, label, text]) => <button className="prompt-chip" key={label} onClick={() => submit(t(text))}><Icon size={16} />{t(label)}</button>)}
      </div>
    </div>
  </div>
}
