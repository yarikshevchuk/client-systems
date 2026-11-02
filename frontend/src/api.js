const TOKEN_KEY = 'token'

export const LOCALE = 'uk-UA'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export const fmt = (date) =>
  date ? new Date(date).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const fmtShort = (date) =>
  date ? new Date(date).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export function plural(n, one, few, many) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const roleName = (role) => ({ student: 'студент', teacher: 'викладач', admin: 'адміністратор' }[role] || role)

export function relative(date) {
  if (!date) return null
  const diff = new Date(date) - new Date()
  if (diff < 0) {
    const days = Math.max(1, Math.round(-diff / 86400000))
    return { text: `Прострочено на ${days} ${plural(days, 'день', 'дні', 'днів')}`, tone: 'bad' }
  }
  const days = Math.round(diff / 86400000)
  if (days === 0) return { text: 'Сьогодні', tone: 'warn' }
  if (days === 1) return { text: 'Завтра', tone: 'warn' }
  return { text: `Через ${days} ${plural(days, 'день', 'дні', 'днів')}`, tone: days <= 3 ? 'warn' : 'ok' }
}

export function timeAgo(date) {
  const seconds = Math.round((Date.now() - new Date(date)) / 1000)
  if (seconds < 60) return 'щойно'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} хв тому`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} год тому`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} ${plural(days, 'день', 'дні', 'днів')} тому`
  return new Date(date).toLocaleDateString(LOCALE, { dateStyle: 'medium' })
}

export function timeUntil(date) {
  const minutes = Math.max(1, Math.round((new Date(date) - Date.now()) / 60000))
  if (minutes < 60) return `${minutes} хв`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} год`
  const days = Math.round(hours / 24)
  return `${days} ${plural(days, 'день', 'дні', 'днів')}`
}

export async function download(path, filename) {
  const response = await fetch('/api' + path, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!response.ok) throw new Error('Не вдалося завантажити файл')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(await response.blob())
  link.download = filename
  link.click()
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body = options.body
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  const response = await fetch('/api' + path, { ...options, headers, body })
  if (response.status === 401 && path !== '/login') {
    setToken(null)
    window.location.assign('/')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data && data.detail
    throw new Error(typeof detail === 'string' ? detail : 'Помилка запиту. Перевірте введені дані')
  }
  return data
}
