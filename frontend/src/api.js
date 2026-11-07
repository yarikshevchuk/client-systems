import { lang, locale, t } from './i18n.js'

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
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? t(data.detail) : t("Помилка запиту. Перевірте введені дані"))
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
  if (!response.ok) return alert(t("Не вдалося завантажити файл"))
  saveFile(await response.blob(), filename)
}

export function saveCsv(rows, filename) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  saveFile(new Blob(['\ufeff' + csv], { type: 'text/csv' }), filename)
}

export const fmt = (date) => (date ? new Date(date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—')
export const fmtShort = (date) => new Date(date).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function plural(n, one, few, many) {
  if (lang === 'en') return n === 1 ? one : many
  if (n % 10 === 1 && n % 100 !== 11) return one
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return few
  return many
}

export const roleName = (role) => ({ student: t("студент"), teacher: t("викладач"), admin: t("адміністратор") }[role])

export function timeAgo(date) {
  const minutes = Math.round((Date.now() - new Date(date)) / 60000)
  if (minutes < 1) return t("щойно")
  if (minutes < 60) return `${minutes} ${t("хв тому")}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${t("год тому")}`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} ${plural(days, t("день"), t("дні"), t("днів"))} ${t("тому")}`
  return new Date(date).toLocaleDateString(locale, { dateStyle: 'medium' })
}

export function deadlineStatus(date) {
  const days = Math.round((new Date(date) - Date.now()) / 86400000)
  if (new Date(date) < new Date()) return { text: `${t("Прострочено на")} ${Math.max(1, -days)} ${plural(Math.max(1, -days), t("день"), t("дні"), t("днів"))}`, tone: 'bad' }
  if (days === 0) return { text: t("Сьогодні"), tone: 'warn' }
  if (days === 1) return { text: t("Завтра"), tone: 'warn' }
  return { text: `${t("Через")} ${days} ${plural(days, t("день"), t("дні"), t("днів"))}`, tone: days <= 3 ? 'warn' : '' }
}
