function normalizeCode(code?: string) {
  return code?.toLowerCase().replace(/_/g, '-')
}

export function getPreferredLanguage(languages: string[], fallback: string) {
  const browserLanguage = normalizeCode(window.navigator.language)

  if (!browserLanguage) {
    return fallback
  }

  const lang = languages.find(lang => {
    const code = normalizeCode(lang)!

    return (
      code === browserLanguage ||
      browserLanguage.startsWith(code) ||
      code.startsWith(browserLanguage)
    )
  })

  return lang || fallback
}

export function getFormLanguage(languages: string[], formLocale?: string, queryLocale?: string) {
  const query = normalizeCode(queryLocale)
  if (query) {
    const queryMatch = languages.find(
      lang =>
        normalizeCode(lang) === query ||
        query.startsWith(normalizeCode(lang)!) ||
        normalizeCode(lang)!.startsWith(query)
    )
    if (queryMatch) return queryMatch
  }

  const locale = normalizeCode(formLocale)
  if (locale) {
    const formMatch = languages.find(
      lang =>
        normalizeCode(lang) === locale ||
        locale.startsWith(normalizeCode(lang)!) ||
        normalizeCode(lang)!.startsWith(locale)
    )
    if (formMatch) return formMatch
  }

  return getPreferredLanguage(languages, 'en')
}
