import React, { createContext, useContext, useEffect, useState } from 'react'
import { appLocale, locales } from '../shared/locale.js'
import { readStorage, saveStorage } from './utils'
import { korean } from './korean'
import { french } from './french'

const dictionaries = { en: { 'Watched status': 'Watched', 'Watchlist tabs saved': 'Saved' }, ko: korean, fr: french }

function translate(locale, message, values = {}) {
  const template = dictionaries[locale][message] ?? message
  return template.replace(/\{(\w+)\}/g, (placeholder, key) => values[key] ?? placeholder)
}

const translators = Object.fromEntries(Object.keys(locales).map(locale => [locale, translate.bind(null, locale)]))
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(() => appLocale(readStorage('locale', document.documentElement.lang)))

  useEffect(() => {
    document.documentElement.lang = locale
    saveStorage('locale', locale)
    document.querySelector('meta[name=description]')?.setAttribute('content',
      translators[locale]('Find a film for whatever you’re feeling. Ask for movie recommendations or look up a title.'))
  }, [locale])

  return <LanguageContext.Provider value={{ locale, setLocale, t: translators[locale] }}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)
