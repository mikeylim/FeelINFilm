export const locales = {
  en: { label: 'English', tmdb: 'en-US', speech: 'en-CA', gemini: 'English (en)' },
  ko: { label: '한국어', tmdb: 'ko-KR', speech: 'ko-KR', gemini: 'Korean (ko-KR, 한국어)' },
  fr: { label: 'Français', tmdb: 'fr-FR', speech: 'fr-CA', gemini: 'French (fr, français)' }
}

export function appLocale(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase().match(/^([a-z]{2})(?:[-,;]|$)/)?.[1] : undefined
  return Object.hasOwn(locales, code) ? code : 'en'
}

export const inLanguage = (locale, messages) => messages[locale] ?? messages.en

const koreanGenres = {
  Action: '액션', Adventure: '모험', Animation: '애니메이션', Comedy: '코미디', Crime: '범죄',
  Documentary: '다큐멘터리', Drama: '드라마', Family: '가족', Fantasy: '판타지', History: '역사',
  Horror: '공포', Music: '음악', Mystery: '미스터리', Romance: '로맨스', 'Science Fiction': 'SF',
  'TV Movie': 'TV 영화', Thriller: '스릴러', War: '전쟁', Western: '서부'
}

const frenchGenres = {
  Action: 'Action', Adventure: 'Aventure', Animation: 'Animation', Comedy: 'Comédie', Crime: 'Policier',
  Documentary: 'Documentaire', Drama: 'Drame', Family: 'Famille', Fantasy: 'Fantastique', History: 'Historique',
  Horror: 'Horreur', Music: 'Musique', Mystery: 'Mystère', Romance: 'Romance', 'Science Fiction': 'Science-fiction',
  'TV Movie': 'Téléfilm', Thriller: 'Thriller', War: 'Guerre', Western: 'Western'
}

export const genreLabel = (name, locale) => inLanguage(locale, { en: name, ko: koreanGenres[name], fr: frenchGenres[name] })

const koreanAcademyCategories = {
  'Best Picture': '작품상', Directing: '감독상',
  'Actor in a Leading Role': '남우주연상', 'Actress in a Leading Role': '여우주연상',
  'Actor in a Supporting Role': '남우조연상', 'Actress in a Supporting Role': '여우조연상',
  'Animated Feature Film': '장편 애니메이션상', 'International Feature Film': '국제장편영화상',
  'Foreign Language Film': '외국어영화상', 'Documentary (Feature)': '장편 다큐멘터리상',
  'Documentary Feature Film': '장편 다큐멘터리상', 'Documentary (Short Subject)': '단편 다큐멘터리상',
  'Documentary Short Film': '단편 다큐멘터리상', 'Short Film (Animated)': '단편 애니메이션상',
  'Animated Short Film': '단편 애니메이션상', 'Short Film (Live Action)': '단편 실사 영화상',
  'Live Action Short Film': '단편 실사 영화상', 'Writing (Original Screenplay)': '각본상',
  'Writing (Adapted Screenplay)': '각색상', 'Music (Original Score)': '음악상',
  'Music (Original Song)': '주제가상', Cinematography: '촬영상', 'Film Editing': '편집상',
  'Visual Effects': '시각효과상', 'Production Design': '미술상', 'Art Direction': '미술상',
  'Costume Design': '의상상', 'Makeup and Hairstyling': '분장상', Sound: '음향상',
  'Sound Editing': '음향편집상', 'Sound Mixing': '음향믹싱상', Casting: '캐스팅상'
}

const frenchAcademyCategories = {
  'Best Picture': 'Meilleur film', Directing: 'Meilleure réalisation',
  'Actor in a Leading Role': 'Meilleur acteur', 'Actress in a Leading Role': 'Meilleure actrice',
  'Actor in a Supporting Role': 'Meilleur acteur dans un second rôle', 'Actress in a Supporting Role': 'Meilleure actrice dans un second rôle',
  'Animated Feature Film': 'Meilleur film d’animation', 'International Feature Film': 'Meilleur film international',
  'Foreign Language Film': 'Meilleur film en langue étrangère', 'Documentary (Feature)': 'Meilleur film documentaire',
  'Documentary Feature Film': 'Meilleur film documentaire', 'Documentary (Short Subject)': 'Meilleur court métrage documentaire',
  'Documentary Short Film': 'Meilleur court métrage documentaire', 'Short Film (Animated)': 'Meilleur court métrage d’animation',
  'Animated Short Film': 'Meilleur court métrage d’animation', 'Short Film (Live Action)': 'Meilleur court métrage de fiction',
  'Live Action Short Film': 'Meilleur court métrage de fiction', 'Writing (Original Screenplay)': 'Meilleur scénario original',
  'Writing (Adapted Screenplay)': 'Meilleur scénario adapté', 'Music (Original Score)': 'Meilleure musique originale',
  'Music (Original Song)': 'Meilleure chanson originale', Cinematography: 'Meilleure photographie', 'Film Editing': 'Meilleur montage',
  'Visual Effects': 'Meilleurs effets visuels', 'Production Design': 'Meilleurs décors', 'Art Direction': 'Meilleurs décors',
  'Costume Design': 'Meilleurs costumes', 'Makeup and Hairstyling': 'Meilleurs maquillages et coiffures', Sound: 'Meilleur son',
  'Sound Editing': 'Meilleur montage sonore', 'Sound Mixing': 'Meilleur mixage sonore', Casting: 'Meilleure distribution'
}

export const academyCategories = { ko: koreanAcademyCategories, fr: frenchAcademyCategories }

export const awardLabel = (category, locale) => academyCategories[locale]?.[category] ?? category
