import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bookmark, Eye, Film, History, Info, Menu, Moon, Plus, Search, Sun, X } from 'lucide-react'
import { locales } from '../shared/locale.js'
import { LanguageProvider, useLanguage } from './Language'
import { Chat } from './Chat'
import { FilmGuideIcon } from './FilmGuideIcon'
import { Lookup } from './Lookup'
import { FilmDetail } from './FilmDetail'
import { Modal } from './Modal'
import { isWatchedPath, watchedPath, Watchlist } from './Watchlist'
import { WatchlistProvider, useWatchlist } from './WatchlistState'
import { api, linkOut, morePrompt, movieTitle, movieYear, readPath, readStorage, requestRecommendations, saveStorage } from './utils'
import './styles.css'

function Sidebar({ path, open, close, expanded, newChat, threads, active, pick, remove, theme, toggleTheme, onAbout }) {
  const { t } = useLanguage()
  const lookup = path.startsWith('/lookup')
  const watchlist = path.split('?')[0] === '/watchlist'
  const watched = isWatchedPath(path)
  const saved = watchlist && !watched
  return <>
    {expanded && <button className="sidebar-overlay" aria-label={t('Close navigation')} onClick={close} />}
    <aside className={`sidebar${expanded ? ' sidebar-open' : ''}`} aria-label={t('Main navigation')}>
      <div className="sidebar-brand">
        <a href="/" className="brand" aria-label={t('FeelINFilm home')} onClick={event => open(event, '/')}>
          <img src="/favicon.svg" alt="" width="37" height="37" />
          <span>Feel<span className="brand-accent">IN</span>Film</span>
        </a>
        <button className="icon-button mobile-close" aria-label={t('Close navigation')} onClick={close}><X size={20} /></button>
      </div>
      <button className="new-chat" onClick={newChat}><Plus size={19} /> {t('New chat')}</button>
      <nav className="sidebar-nav">
        <a className={lookup || watchlist ? 'nav-item' : 'nav-item selected'} aria-current={!lookup && !watchlist ? 'page' : undefined} href="/" onClick={event => open(event, '/')}><FilmGuideIcon /> {t('AI movie chat')}</a>
        <a className={lookup ? 'nav-item selected' : 'nav-item'} aria-current={lookup ? 'page' : undefined} href="/lookup" onClick={event => open(event, '/lookup')}><Search size={18} /> {t('Movie lookup')}</a>
        <a className={watched ? 'nav-item selected' : 'nav-item'} aria-current={watched ? 'page' : undefined} href={watchedPath} onClick={event => open(event, watchedPath)}><Eye size={18} /> {t('Watched')}</a>
        <a className={saved ? 'nav-item selected' : 'nav-item'} aria-current={saved ? 'page' : undefined} href="/watchlist" onClick={event => open(event, '/watchlist')}><Bookmark size={18} /> {t('Watchlist')}</a>
      </nav>
      <section className="sidebar-history" aria-label={t('Recent chats')}>
        <h2>{t('Recent chats')}</h2>
        {threads.length ? <ul>{threads.map(thread => <li key={thread.id}>
          <button className={thread.id === active && path === '/' ? 'history-link history-active' : 'history-link'} title={thread.title} onClick={() => pick(thread.id)}><History size={15} /><span>{thread.title}</span></button>
          <button className="history-remove icon-button" title={t('Delete chat')} aria-label={t('Delete chat {title}', { title: thread.title })} onClick={() => remove(thread.id)}><X size={14} /></button>
        </li>)}</ul> : <p className="history-empty">{t('Your chats will appear here.')}</p>}
      </section>
      <div className="sidebar-footer">
        <button className="nav-item theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')}>
          {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
          <span>{theme === 'dark' ? t('Dark mode') : t('Light mode')}</span><span className={theme === 'dark' ? 'theme-switch on' : 'theme-switch'} aria-hidden="true"><i /></span>
        </button>
        <button className="nav-item" onClick={onAbout}><Info size={17} /> {t('About & credits')}</button>
      </div>
    </aside>
  </>
}

function About({ providers, onClose }) {
  const { t } = useLanguage()
  return <Modal title={t('About FeelINFilm')} onClose={onClose}>
    <p>{t('FeelINFilm helps you find a movie by title or talk through what you feel like watching.')}</p>
    {providers && <dl className="provider-status">
      <div><dt>{t('TMDB movie lookup')}</dt><dd>{providers.tmdb ? t('Configured') : t('Credential needed')}</dd></div>
      <div><dt>{t('Gemini recommendations')}</dt><dd>{providers.gemini && providers.tmdb ? t('Configured') : t('Setup needed')}</dd></div>
      <div><dt>{t('OMDb ratings and awards')}</dt><dd>{providers.omdb ? t('Configured') : t('Optional key')}</dd></div>
      <div><dt>{t('MDBList scores')}</dt><dd>{providers.mdblist ? t('Configured') : t('Optional key')}</dd></div>
    </dl>}
    <p>{t('Chats, saved films, and watched films are stored in this browser. Gemini receives the current conversation and, when watched films are excluded, recent watched titles.')}</p>
    <div className="credits">
      <a href="https://www.themoviedb.org" {...linkOut}><img width="49" src="/tmdb.svg" alt="TMDB" /></a>
      <p>{t('This product uses the TMDB API but is not endorsed or certified by TMDB.')}</p>
      <p>{t('Scores and awards use {omdb} and {mdblist} where available.', { omdb: 'OMDb', mdblist: 'MDBList' })
        .split(/(OMDb|MDBList)/).map((part, index) => part === 'OMDb' || part === 'MDBList'
          ? <a key={index} className="text-link" href={part === 'OMDb' ? 'https://www.omdbapi.com/' : 'https://mdblist.com/'} {...linkOut}>{part}</a>
          : part)}</p>
    </div>
  </Modal>
}

function previouslyShown(messages) {
  const movies = messages.flatMap(message => message.movies || [])
  return [...new Map(movies.map(({ id, title }) => [id, { id, title }])).values()].slice(-75)
}

function App() {
  const { locale, setLocale, t } = useLanguage()
  const { refresh, excludeWatched, watchedMovies, watchedById } = useWatchlist()
  const [path, setPath] = useState(readPath)
  const [returnPath, setReturnPath] = useState(() => window.history.state?.from || '/lookup')
  const [filmTitle, setFilmTitle] = useState('')
  const [theme, setTheme] = useState(() => readStorage('theme', 'dark') === 'light' ? 'light' : 'dark')
  const [threads, setThreads] = useState(() => {
    const saved = readStorage('chats', [])
    return Array.isArray(saved) ? saved : []
  })
  const [activeId, setActiveId] = useState(() => {
    const id = readStorage('active', '', 'sessionStorage')
    const saved = threads.find(item => item.id === id)
    const replies = saved?.messages.filter(message => message.role === 'assistant') || []
    return replies.length && replies.every(message => message.source === 'preview') ? '' : id
  })
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState({})
  const [errors, setErrors] = useState({})
  const [providers, setProviders] = useState(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const focusComposer = useRef(null)
  const requests = useRef(new Map())

  const isLookup = path.startsWith('/lookup')
  const isWatchlist = path.split('?')[0] === '/watchlist'
  const watchedTab = isWatchedPath(path)
  const filmId = path.match(/^\/movie\/(\d+)(?:\?|$)/)?.[1]
  const lookupQuery = isLookup ? new URL(path, window.location.origin).searchParams.get('q') || '' : ''
  const thread = threads.find(item => item.id === activeId)

  useEffect(() => {
    const pop = () => {
      setFilmTitle('')
      setPath(readPath())
      setReturnPath(window.history.state?.from || '/lookup')
      setExpanded(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    api('home', { signal: abort.signal }).then(data => setProviders(data.providers)).catch(() => {})
    return () => abort.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#101713' : '#f8faf5')
    saveStorage('theme', theme)
  }, [theme])

  useEffect(() => { saveStorage('chats', threads) }, [threads])
  useEffect(() => { saveStorage('active', activeId, 'sessionStorage') }, [activeId])

  useEffect(() => {
    const title = filmTitle || (isLookup ? t('Movie lookup') : watchedTab ? t('Watched') : isWatchlist ? t('Watchlist') : '')
    document.title = title ? `${title} · FeelINFilm` : `FeelINFilm · ${t('Find your next film')}`
  }, [isLookup, isWatchlist, watchedTab, filmTitle, t])

  useEffect(() => {
    if (!expanded) return
    const dismiss = event => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [expanded])

  function navigate(next) {
    setExpanded(false)
    if (path === next) return
    const nextIsFilm = /^\/movie\/\d+/.test(next)
    const from = nextIsFilm ? (filmId ? returnPath : path) : undefined
    window.history.pushState(from ? { from } : null, '', next)
    if (from) setReturnPath(from)
    setFilmTitle('')
    setPath(next)
    window.scrollTo(0, 0)
  }

  function open(event, next) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    navigate(next)
  }

  function pickChat(id) {
    setActiveId(id)
    setDraft('')
    navigate('/')
    window.scrollTo(0, 0)
  }

  function newChat() {
    pickChat('')
    requestAnimationFrame(() => focusComposer.current?.())
  }

  function removeChat(id) {
    requests.current.get(id)?.abort()
    setThreads(items => items.filter(item => item.id !== id))
    if (id === activeId) {
      setActiveId('')
      setDraft('')
    }
  }

  async function sendTurn(id, messages, excluded) {
    if (requests.current.has(id)) return
    const controller = new AbortController()
    const replyId = crypto.randomUUID()
    requests.current.set(id, controller)
    setPending(values => ({ ...values, [id]: { stage: 'gemini' } }))
    setErrors(values => ({ ...values, [id]: null }))
    const liveHistory = messages.filter(message => message.source !== 'preview')
    const criteria = liveHistory.findLast(message => message.role === 'assistant')?.criteria
    const turns = liveHistory.slice(-12)
    if (turns[0] !== liveHistory[0]) turns.unshift(liveHistory[0])
    const context = turns.map(message => ({
      role: message.role,
      text: message.role === 'assistant' && message.movies?.length ?
        `${message.text}\nFilms recommended: ${message.movies.map(movie => `${movie.title} (${movieYear(movie) || 'year unknown'})`).join(', ')}`.slice(0, 1600) : message.text
    }))
    const watched = excludeWatched && watchedMovies.length ? {
      ids: [...watchedById.keys()],
      recentTitles: watchedMovies.slice(0, 30).map(movie => {
        const title = movie.title.slice(0, 160)
        const year = movieYear(movie)
        return year ? `${title} (${year})` : title
      })
    } : undefined
    const storeReply = result => {
      refresh(result.movies || [])
      setThreads(items => items.map(item => item.id === id ? {
        ...item, messages: [...item.messages, { ...result, id: replyId, role: 'assistant' }]
      } : item))
    }
    let partial
    try {
      const result = await requestRecommendations({
        messages: context, exclude: excluded, watched, criteria, lockCriteria: Boolean(criteria && messages.at(-1).display)
      }, controller.signal, event => {
        if (event.type === 'stage') setPending(values => ({ ...values, [id]: { ...values[id], stage: event.stage } }))
        if (event.type === 'cards') {
          partial = event.result
          const reply = { ...event.result, id: replyId, role: 'assistant' }
          setPending(values => ({ ...values, [id]: { ...values[id], reply } }))
        }
      }, locale)
      storeReply(result)
    } catch (error) {
      if (partial) storeReply(partial)
      else setErrors(values => ({ ...values, [id]: { message: controller.signal.aborted ? t('Reply stopped.') : error.message, excluded } }))
    } finally {
      requests.current.delete(id)
      setPending(values => {
        const next = { ...values }
        delete next[id]
        return next
      })
    }
  }

  function submit(text, { fresh = false, more = false } = {}) {
    const prompt = text.trim().slice(0, 1600)
    const current = fresh ? undefined : thread
    if (!prompt || (current && requests.current.has(current.id))) return
    const id = current?.id || crypto.randomUUID()
    const previous = current?.messages || []
    // An unsent server response has no model turn. A new prompt replaces the failed turn.
    const completed = previous.at(-1)?.role === 'user' ? previous.slice(0, -1) : previous
    const messages = [...completed, { id: crypto.randomUUID(), role: 'user', text: prompt, display: more ? 'Show me more picks' : undefined }]
    const nextThread = { id, title: current?.title || prompt, messages }
    const exclude = more ? previouslyShown(completed) : []
    setThreads(items => [nextThread, ...items.filter(item => item.id !== id)].slice(0, 15))
    setActiveId(id)
    setDraft('')
    navigate('/')
    sendTurn(id, messages, exclude)
  }

  const label = filmId ? filmTitle || t('Film details') : isLookup ? t('Movie lookup') : watchedTab ? t('Watched') : isWatchlist ? t('Watchlist') : t('AI movie chat')
  const live = providers?.gemini && providers?.tmdb
  const interrupted = !pending[activeId] && thread?.messages.at(-1)?.role === 'user'
  const chatError = errors[activeId]?.message || (interrupted ? t('The last reply was interrupted.') : '')
  const retry = () => {
    if (!thread) return
    const excluded = errors[activeId]?.excluded ||
      (thread.messages.at(-1)?.display ? previouslyShown(thread.messages) : [])
    sendTurn(activeId, thread.messages, excluded)
  }
  return <div className="app-shell">
    <Sidebar path={filmId ? returnPath : path} open={open} close={() => setExpanded(false)} expanded={expanded} newChat={newChat}
      threads={threads} active={activeId} pick={pickChat} remove={removeChat} theme={theme}
      toggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} onAbout={() => { setExpanded(false); setAboutOpen(true) }} />
    <div className="main-panel">
      <header className="topbar">
        <div className="topbar-title">
          <button className="icon-button mobile-menu" aria-label={t('Open navigation')} aria-expanded={expanded} onClick={() => setExpanded(true)}><Menu size={21} /></button>
          {filmId ? <Film size={17} /> : isLookup ? <Search size={17} /> : watchedTab ? <Eye size={17} /> : isWatchlist ? <Bookmark size={17} /> : <FilmGuideIcon size={17} />}
          <span>{label}</span>
        </div>
        <div className="topbar-actions">
          <select className="language-select" aria-label={t('Site language')} value={locale} onChange={event => {
            setLocale(event.target.value)
            setFilmTitle('')
          }}>
            {Object.entries(locales).map(([code, { label }]) => <option key={code} value={code} lang={code}>{label}</option>)}
          </select>
          {providers && !isWatchlist && <button className="connection-badge" onClick={() => setAboutOpen(true)}>
            {((isLookup || filmId) ? providers.tmdb : live) && <i aria-hidden="true" />}
            {isLookup || filmId ? providers.tmdb ? 'TMDB' : t('Setup needed') : live ? 'Gemini' : t('Setup needed')}
          </button>}
        </div>
      </header>
      <main id="main-content">
        {filmId ? <FilmDetail key={`${filmId}:${locale}`} id={filmId} back={returnPath} setTitle={setFilmTitle} open={open}
          onSimilar={movie => submit(t('I’m looking for films like {title}{year}. What should I watch?', {
            title: movieTitle(movie, locale), year: movieYear(movie) ? ` (${movieYear(movie)})` : ''
          }), { fresh: true })} /> :
          isLookup ? <Lookup key={`${lookupQuery}:${locale}`} query={lookupQuery} onSearch={query => navigate(query ? `/lookup?${new URLSearchParams({ q: query })}` : '/lookup')}
            open={open} /> :
            isWatchlist ? <Watchlist key={watchedTab ? 'watched' : 'saved'} watched={watchedTab} open={open} /> :
            <Chat thread={thread} pending={pending[activeId]} draft={draft} setDraft={setDraft} submit={submit}
              retry={retry} stop={() => requests.current.get(activeId)?.abort()} error={chatError} onFocusRef={focusComposer}
              onMore={() => submit(t(morePrompt), { more: true })} open={open} />}
      </main>
    </div>
    {aboutOpen && <About providers={providers} onClose={() => setAboutOpen(false)} />}
  </div>
}

createRoot(document.getElementById('root')).render(<LanguageProvider><WatchlistProvider><App /></WatchlistProvider></LanguageProvider>)
