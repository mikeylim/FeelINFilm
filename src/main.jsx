import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bookmark, Eye, Film, History, Info, Menu, Moon, Plus, Search, Sun, X } from 'lucide-react'
import { Chat } from './Chat'
import { FilmGuideIcon } from './FilmGuideIcon'
import { Lookup } from './Lookup'
import { FilmDetail } from './FilmDetail'
import { isWatchedPath, watchedPath, Watchlist } from './Watchlist'
import { WatchlistProvider, useWatchlist } from './WatchlistState'
import { api, linkOut, morePrompt, movieYear, readPath, readStorage, requestRecommendations, saveStorage } from './utils'
import './styles.css'

function Sidebar({ path, open, close, expanded, newChat, threads, active, pick, remove, theme, toggleTheme, onAbout }) {
  const lookup = path.startsWith('/lookup')
  const watchlist = path.split('?')[0] === '/watchlist'
  const watched = isWatchedPath(path)
  const saved = watchlist && !watched
  return <>
    {expanded && <button className="sidebar-overlay" aria-label="Close navigation" onClick={close} />}
    <aside className={`sidebar${expanded ? ' sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <a href="/" className="brand" aria-label="FeelINFilm home" onClick={event => open(event, '/')}>
          <img src="/favicon.svg" alt="" width="37" height="37" />
          <span>Feel<span className="brand-accent">IN</span>Film</span>
        </a>
        <button className="icon-button mobile-close" aria-label="Close navigation" onClick={close}><X size={20} /></button>
      </div>
      <button className="new-chat" onClick={newChat}><Plus size={19} /> New chat</button>
      <nav className="sidebar-nav">
        <a className={lookup || watchlist ? 'nav-item' : 'nav-item selected'} aria-current={!lookup && !watchlist ? 'page' : undefined} href="/" onClick={event => open(event, '/')}><FilmGuideIcon /> AI movie chat</a>
        <a className={lookup ? 'nav-item selected' : 'nav-item'} aria-current={lookup ? 'page' : undefined} href="/lookup" onClick={event => open(event, '/lookup')}><Search size={18} /> Movie lookup</a>
        <a className={saved ? 'nav-item selected' : 'nav-item'} aria-current={saved ? 'page' : undefined} href="/watchlist" onClick={event => open(event, '/watchlist')}><Bookmark size={18} /> Watchlist</a>
        <a className={watched ? 'nav-item selected' : 'nav-item'} aria-current={watched ? 'page' : undefined} href={watchedPath} onClick={event => open(event, watchedPath)}><Eye size={18} /> Watched</a>
      </nav>
      <section className="sidebar-history" aria-label="Recent chats">
        <h2>Recent chats</h2>
        {threads.length ? <ul>{threads.map(thread => <li key={thread.id}>
          <button className={thread.id === active && path === '/' ? 'history-link history-active' : 'history-link'} title={thread.title} onClick={() => pick(thread.id)}><History size={15} /><span>{thread.title}</span></button>
          <button className="history-remove icon-button" title="Delete chat" aria-label={`Delete chat ${thread.title}`} onClick={() => remove(thread.id)}><X size={14} /></button>
        </li>)}</ul> : <p className="history-empty">Your chats will appear here.</p>}
      </section>
      <div className="sidebar-footer">
        <button className="nav-item theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
          <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span><span className={theme === 'dark' ? 'theme-switch on' : 'theme-switch'} aria-hidden="true"><i /></span>
        </button>
        <button className="nav-item" onClick={onAbout}><Info size={17} /> About & credits</button>
      </div>
    </aside>
  </>
}

function Modal({ title, children, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => { if (node.open) node.close() }
  }, [])

  return <dialog className="dialog" ref={dialog} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-inner">
      <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21} /></button></div>
      {children}
    </div>
  </dialog>
}

function About({ providers, onClose }) {
  return <Modal title="About FeelINFilm" onClose={onClose}>
    <p>FeelINFilm helps you find a movie by title or talk through what you feel like watching.</p>
    {providers && <dl className="provider-status">
      <div><dt>TMDB movie lookup</dt><dd>{providers.tmdb ? 'Configured' : 'Credential needed'}</dd></div>
      <div><dt>Gemini recommendations</dt><dd>{providers.gemini && providers.tmdb ? 'Configured' : 'Setup needed'}</dd></div>
      <div><dt>OMDb ratings and awards</dt><dd>{providers.omdb ? 'Configured' : 'Optional key'}</dd></div>
      <div><dt>MDBList scores</dt><dd>{providers.mdblist ? 'Configured' : 'Optional key'}</dd></div>
    </dl>}
    <p>Chats, saved films, and watched films are stored in this browser. Gemini receives the current conversation and, when watched films are excluded, recent watched titles.</p>
    <div className="credits">
      <a href="https://www.themoviedb.org" {...linkOut}><img width="49" src="/tmdb.svg" alt="TMDB" /></a>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>Scores and awards use <a className="text-link" href="https://www.omdbapi.com/" {...linkOut}>OMDb</a> and <a className="text-link" href="https://mdblist.com/" {...linkOut}>MDBList</a> where available.</p>
    </div>
  </Modal>
}

function previouslyShown(messages) {
  const movies = messages.flatMap(message => message.movies || [])
  return [...new Map(movies.map(({ id, title }) => [id, { id, title }])).values()].slice(-75)
}

function App() {
  const { refresh, excludeWatched, watchedMovies, watchedIds } = useWatchlist()
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
    const title = filmTitle || (isLookup ? 'Movie lookup' : watchedTab ? 'Watched' : isWatchlist ? 'Watchlist' : '')
    document.title = title ? `${title} · FeelINFilm` : 'FeelINFilm · Find your next film'
  }, [isLookup, isWatchlist, watchedTab, filmTitle])

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
      ids: [...watchedIds],
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
        if (event.type === 'stage') setPending(values => ({ ...values, [id]: { stage: event.stage } }))
        if (event.type === 'cards') {
          partial = event.result
          setPending(values => ({ ...values, [id]: { stage: 'ratings', reply: { ...partial, id: replyId, role: 'assistant' } } }))
        }
      })
      storeReply(result)
    } catch (error) {
      if (partial) storeReply(partial)
      else setErrors(values => ({ ...values, [id]: { message: controller.signal.aborted ? 'Reply stopped.' : error.message, excluded } }))
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

  const label = filmId ? filmTitle || 'Film details' : isLookup ? 'Movie lookup' : watchedTab ? 'Watched' : isWatchlist ? 'Watchlist' : 'AI movie chat'
  const live = providers?.gemini && providers?.tmdb
  const interrupted = !pending[activeId] && thread?.messages.at(-1)?.role === 'user'
  const chatError = errors[activeId]?.message || (interrupted ? 'The last reply was interrupted.' : '')
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
          <button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={expanded} onClick={() => setExpanded(true)}><Menu size={21} /></button>
          {filmId ? <Film size={17} /> : isLookup ? <Search size={17} /> : watchedTab ? <Eye size={17} /> : isWatchlist ? <Bookmark size={17} /> : <FilmGuideIcon size={17} />}
          <span>{label}</span>
        </div>
        {providers && !isWatchlist && <button className="connection-badge" onClick={() => setAboutOpen(true)}>
          {((isLookup || filmId) ? providers.tmdb : live) && <i aria-hidden="true" />}
          {isLookup || filmId ? providers.tmdb ? 'TMDB' : 'Setup needed' : live ? 'Gemini' : 'Setup needed'}
        </button>}
      </header>
      <main id="main-content">
        {filmId ? <FilmDetail key={filmId} id={filmId} back={returnPath} setTitle={setFilmTitle} open={open}
          onSimilar={movie => submit(`I’m looking for films like ${movie.title}${movieYear(movie) ? ` (${movieYear(movie)})` : ''}. What should I watch?`, { fresh: true })} /> :
          isLookup ? <Lookup key={lookupQuery} query={lookupQuery} onSearch={query => navigate(query ? `/lookup?${new URLSearchParams({ q: query })}` : '/lookup')}
            open={open} /> :
            isWatchlist ? <Watchlist watched={watchedTab} open={open} /> :
            <Chat thread={thread} pending={pending[activeId]} draft={draft} setDraft={setDraft} submit={submit}
              retry={retry} stop={() => requests.current.get(activeId)?.abort()} error={chatError} onFocusRef={focusComposer}
              onMore={() => submit(morePrompt, { more: true })} open={open} />}
      </main>
    </div>
    {aboutOpen && <About providers={providers} onClose={() => setAboutOpen(false)} />}
  </div>
}

createRoot(document.getElementById('root')).render(<WatchlistProvider><App /></WatchlistProvider>)
