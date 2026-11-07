export const getToken = () => localStorage.getItem('token')

export function setToken(token) {
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

export async function api(path, options = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` }
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
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Помилка запиту. Перевірте введені дані')
  return data
}

function saveFile(blob, filename) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

export async function download(path, filename) {
  const response = await fetch('/api' + path, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!response.ok) return alert('Не вдалося завантажити файл')
  saveFile(await response.blob(), filename)
}

export function saveCsv(rows, filename) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  saveFile(new Blob(['\ufeff' + csv], { type: 'text/csv' }), filename)
}

export const fmt = (date) => (date ? new Date(date).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
export const fmtShort = (date) => new Date(date).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function plural(n, one, few, many) {
  if (n % 10 === 1 && n % 100 !== 11) return one
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return few
  return many
}

export const roleName = (role) => ({ student: 'студент', teacher: 'викладач', admin: 'адміністратор' }[role])

export function timeAgo(date) {
  const minutes = Math.round((Date.now() - new Date(date)) / 60000)
  if (minutes < 1) return 'щойно'
  if (minutes < 60) return `${minutes} хв тому`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} год тому`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} ${plural(days, 'день', 'дні', 'днів')} тому`
  return new Date(date).toLocaleDateString('uk-UA', { dateStyle: 'medium' })
}

export function deadlineStatus(date) {
  const days = Math.round((new Date(date) - Date.now()) / 86400000)
  if (new Date(date) < new Date()) return { text: `Прострочено на ${Math.max(1, -days)} ${plural(Math.max(1, -days), 'день', 'дні', 'днів')}`, tone: 'bad' }
  if (days === 0) return { text: 'Сьогодні', tone: 'warn' }
  if (days === 1) return { text: 'Завтра', tone: 'warn' }
  return { text: `Через ${days} ${plural(days, 'день', 'дні', 'днів')}`, tone: days <= 3 ? 'warn' : '' }
}
