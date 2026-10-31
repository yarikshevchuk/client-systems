const TOKEN_KEY = 'token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export const fmt = (date) =>
  date ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export function relative(date) {
  if (!date) return null
  const diff = new Date(date) - new Date()
  if (diff < 0) {
    const days = Math.max(1, Math.round(-diff / 86400000))
    return { text: `${days} day${days > 1 ? 's' : ''} overdue`, tone: 'bad' }
  }
  const days = Math.round(diff / 86400000)
  if (days === 0) return { text: 'Due today', tone: 'warn' }
  if (days === 1) return { text: 'Due tomorrow', tone: 'warn' }
  return { text: `In ${days} days`, tone: days <= 3 ? 'warn' : 'ok' }
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
    throw new Error(typeof detail === 'string' ? detail : 'Request failed')
  }
  return data
}
