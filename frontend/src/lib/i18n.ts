import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '@/locales/en/translation.json'
import ar from '@/locales/ar/translation.json'

const resources = {
  en: { translation: en },
  ar: { translation: ar },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Set document direction based on language
i18n.on('languageChanged', (lng) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lng
})

// Initialize direction on load
const initDir = i18n.language === 'ar' ? 'rtl' : 'ltr'
document.documentElement.dir = initDir
document.documentElement.lang = i18n.language || 'en'


// Normalize Frappe datetime strings for cross-browser compatibility.
// Safari cannot parse "YYYY-MM-DD HH:MM:SS" (space separator) – it needs ISO 8601 with "T".
// Frappe stores datetimes in the server/user local timezone without timezone info.
// Do NOT append "Z" – that would wrongly treat local times as UTC and shift the display.
export const parseFrappeDate = (v: string | Date): Date => {
  if (v instanceof Date) return v
  const raw = String(v).trim()
  if (!raw) return new Date('')

  // Date-only strings: parse as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`)
  }

  // ISO format (T separator) without timezone: parse as local time
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
    const iso = raw.replace(/\.(\d{3})\d+$/, '.$1')
    return new Date(iso)
  }

  // Frappe format "YYYY-MM-DD HH:MM:SS": replace space with T, parse as local time
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
    const iso = raw.replace(' ', 'T').replace(/\.(\d{3})\d+$/, '.$1')
    return new Date(iso)
  }

  return new Date(raw)
}

// Format date only
export const formatDate = (v?: string | Date) => {
  if (!v) return "-"
  try {
    const dt = parseFrappeDate(v)
    if (Number.isNaN(dt.getTime())) return String(v)
    const lang = i18n.language || 'en'

    return new Intl.DateTimeFormat(lang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      numberingSystem: lang === 'ar' ? 'arab' : undefined, // Arabic numerals if Arabic
    }).format(dt)
  } catch {
    return String(v)
  }
}

// Format time only
export const formatTime = (v?: string | Date) => {
  if (!v) return ""
  try {
    const dt = parseFrappeDate(v)
    if (Number.isNaN(dt.getTime())) return ""
    const lang = i18n.language || 'en'

    return new Intl.DateTimeFormat(lang, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: lang !== 'ar', // 24h for Arabic, 12h for others
      numberingSystem: lang === 'ar' ? 'arab' : undefined, // Arabic numerals if Arabic
    }).format(dt)
  } catch {
    return ""
  }
}

// Format both date and time together
export const formatDateTime = (v?: string | Date) => {
  if (!v) return "-"
  try {
    const dt = parseFrappeDate(v)
    if (Number.isNaN(dt.getTime())) return String(v)
    const lang = i18n.language || 'en'
    const date = formatDate(dt)
    const time = formatTime(dt)
    const atWord = lang === 'ar' ? 'الساعة' : 'at'
    return `${date} ${atWord} ${time}`
  } catch {
    return String(v)
  }
}
export default i18n
