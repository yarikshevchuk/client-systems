import EN from './en.js'

export const lang = localStorage.getItem('lang') || 'uk'
export const locale = lang === 'en' ? 'en-GB' : 'uk-UA'

export function t(text, values = {}) {
    let result = (lang === 'en' && EN[text]) || text
    for (const [key, value] of Object.entries(values)) result = result.replace(`{${key}}`, value)
    return result
}

export function switchLang() {
    localStorage.setItem('lang', lang === 'en' ? 'uk' : 'en')
    window.location.reload()
}
