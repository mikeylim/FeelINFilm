import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowUp, Clapperboard, Coffee, Film, Mic, MicOff, Plus, Square, Trophy
} from 'lucide-react'
import { FilmGuideIcon } from './FilmGuideIcon'
import { MovieShelf } from './Movies'
import { linkOut } from './utils'

const prompts = [
  [Coffee, 'Cozy night in', 'I’m in the mood for a cozy, feel-good movie. What should I watch?'],
  [Film, 'Similar to Arrival', 'I enjoyed Arrival. Recommend similar movies with a thoughtful, atmospheric feel.'],
  [Trophy, 'Oscar winners', 'Recommend a few films that won Oscars at the 2020 ceremony.'],
  [Clapperboard, 'Best of the ’90s', 'What are some of the best movies released in the 1990s?']
]

function Composer({ draft, setDraft, onSend, stop, busy, onFocusRef, active }) {
  const textarea = useRef(null)
  const recognizer = useRef(null)
  const [listening, setListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const submit = () => { if (!busy && draft.trim()) onSend(draft) }
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
    speech.lang = navigator.language || 'en-CA'
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
    {voiceStatus && <div className="voice-status" role="status">{voiceStatus}</div>}
    <form className="composer" onSubmit={event => { event.preventDefault(); submit() }}>
      <label htmlFor="chat-prompt" className="sr-only">Movie request</label>
      <textarea ref={textarea} value={draft} id="chat-prompt" maxLength={1600}
        placeholder={active ? 'Ask for more movies or narrow your picks…' : 'Describe a mood, a movie you love, or what you want to watch…'}
        onChange={event => setDraft(event.target.value)} rows={1}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }} />
      <div className="composer-actions">
        <button type="button" className={listening ? 'icon-button mic listening' : 'icon-button mic'} onClick={voice}
          title={listening ? 'Stop listening' : 'Use voice input'} aria-label={listening ? 'Stop listening' : 'Use voice input'} aria-pressed={listening}>
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        {busy ? <button type="button" className="send-button" onClick={stop} aria-label="Stop reply" title="Stop reply"><Square size={14} fill="currentColor" /></button> :
          <button type="submit" className="send-button" disabled={!draft.trim()} aria-label="Send movie request" title="Send movie request"><ArrowUp size={20} strokeWidth={2.4} /></button>}
      </div>
    </form>
  </div>
}

const progress = {
  matching: 'Verifying film matches',
  ratings: 'Loading film ratings'
}

export function Chat({ thread, pending, draft, setDraft, submit, retry, stop, error, onFocusRef, onMore, open }) {
  const savedMessages = thread?.messages || []
  const messages = pending?.reply ? [...savedMessages, pending.reply] : savedMessages
  const busy = Boolean(pending)
  const active = messages.length > 0
  const chatEnd = useRef(null)
  const lastReply = useRef(null)
  const last = messages.at(-1)

  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => {
      if (last.role === 'assistant') {
        const turn = lastReply.current?.previousElementSibling || lastReply.current
        turn?.scrollIntoView({ block: 'start', behavior: 'instant' })
      }
      else chatEnd.current?.scrollIntoView({ block: 'end', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [active, thread?.id, last?.id, last?.role])

  const composer = <Composer draft={draft} setDraft={setDraft} onSend={submit} stop={stop} busy={busy} onFocusRef={onFocusRef} active={active} />
  return active ? <div className="content chat-content">
    <h1 className="sr-only">Movie recommendation chat</h1>
    <div className="conversation" aria-label="Movie conversation">
      {messages.map((message, index) => message.role === 'user'
        ? <div className="user-turn" key={message.id}><p>{message.display || message.text}</p></div>
        : <section className="assistant-turn" key={message.id} ref={index === messages.length - 1 ? lastReply : undefined} aria-label="FeelINFilm response">
          <div className="assistant-identity" title={message.model}><span><FilmGuideIcon /></span> {message.source === 'preview' ? 'Saved preview reply' : 'FeelINFilm'}</div>
          <p className="assistant-copy">{message.text}</p>
          {message.awardSource && <a className="text-link award-source" href={message.awardSource} {...linkOut}>Check the official Academy results</a>}
          <MovieShelf movies={message.movies || []} heading={message.movies?.length ? 'Your recommendations' : ''}
            sortEnabled withReason eager={index === messages.length - 1} open={open} />
          {index === messages.length - 1 && !busy && ((message.movies?.length || 0) > 0 || message.followUps?.length > 0) &&
            <div className="followups">
              {message.movies?.length > 0 && <button className="prompt-chip more-picks" onClick={onMore}><Plus size={16} /> More picks</button>}
              {message.followUps?.map((text, index) => <button key={`${index}-${text}`} className="prompt-chip" onClick={() => submit(text)}>{text}</button>)}
            </div>}
        </section>)}
      {busy && <div className="assistant-identity thinking" role="status"><span><FilmGuideIcon /></span> {progress[pending.stage] || 'Curating your film recommendations'}<span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
      {error && <div className="chat-error" role="alert"><p>{error}</p><button className="button secondary" onClick={retry}>Try again</button></div>}
      <div ref={chatEnd} />
    </div>
    <div className="sticky-composer">{composer}</div>
  </div> : <div className="content home-content">
    <section className="hero">
      <div className="hero-copy">
        <h1>What are you in<br /><em>the mood for?</em></h1>
        <p>Tell us how you’re feeling, what you love, or what you’re curious about. Find a film that fits.</p>
      </div>
    </section>
    <div className="home-composer">
      {composer}
      <div className="prompt-list" aria-label="Try a movie prompt">
        {prompts.map(([Icon, label, text]) => <button className="prompt-chip" key={label} onClick={() => submit(text)}><Icon size={16} />{label}</button>)}
      </div>
    </div>
  </div>
}
