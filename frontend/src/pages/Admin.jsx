import { useEffect, useState } from 'react'
import { api, saveCsv, timeAgo } from '../api.js'
import { Avatar, Icon, Loading } from '../components/ui.jsx'
import { t } from '../i18n.js'

function RegistryImport({ onDone }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function upload(event) {
    const form = new FormData()
    form.append('file', event.target.files[0])
    try {
      setResult(await api('/admin/import', { method: 'POST', body: form }))
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  function saveAccounts() {
    const rows = result.created.map((r) => [r.ticket, r.name, r.group, r.role, r.email, r.password])
    saveCsv([[t("Номер квитка"), t("ПІБ"), t("Група"), t("Роль"), t("Пошта"), t("Пароль")], ...rows], 'oblikovi-zapysy.csv')
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><span className="icon-wrap"><Icon name="upload" size={16} /></span><h2>{t("Імпорт реєстру деканату")}</h2></div>
      <p className="muted small">{t("CSV з колонками: номер студентського квитка, ПІБ, група (необов'язково четверта — роль student або teacher). Для кожного рядка створюється обліковий запис із поштою й паролем, роль і група призначаються автоматично.")}</p>
      <div className="row" style={{ marginTop: 12 }}>
        <label className="btn"><Icon name="upload" size={16} />{t("Завантажити CSV")}<input type="file" accept=".csv" hidden onChange={upload} /></label>
        {result?.created.length > 0 && <button className="btn secondary" onClick={saveAccounts}><Icon name="download" size={16} />{t("Зберегти паролі (")}{result.created.length})</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <div style={{ marginTop: 14 }}>
          <p><b>{t("Створено:")} {result.created.length}</b>{result.skipped.length > 0 && <span className="muted"> {t("· пропущено:")} {result.skipped.length}</span>}</p>
          {result.created.length > 0 && <p className="muted small">{t("Паролі показуються лише зараз. Збережіть файл і передайте студентам.")}</p>}
          {result.skipped.map((row, index) => <div key={index} className="muted small">«{row.row}» — {row.reason}</div>)}
        </div>
      )}
    </div>
  )
}

export default function Admin({ user }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)

  function load() {
    api('/admin/stats').then(setStats)
    api('/admin/users').then(setUsers)
  }

  useEffect(() => {
    if (user.role === 'admin') load()
  }, [])

  async function setRole(row, role) {
    await api(`/admin/users/${row.id}`, { method: 'PUT', body: { role } })
    load()
  }

  if (user.role !== 'admin') return <p className="error">{t("У вас немає доступу до цієї сторінки.")}</p>
  if (!stats || !users) return <Loading />

  const tiles = [[t("Користувачі"), stats.users, 'users'], [t("Студенти"), stats.students, 'user'], [t("Викладачі"), stats.teachers, 'book'], [t("Курси"), stats.courses, 'layers'], [t("Здані роботи"), stats.submissions, 'file'], [t("Повідомлення"), stats.messages, 'chat']]

  return (
    <>
      <div className="page-head"><h1>{t("Адміністрування")}</h1></div>
      <div className="grid three">
        {tiles.map(([label, value, icon]) => (
          <div className="card tile" key={label}><span className="icon-wrap"><Icon name={icon} /></span><div><strong>{value}</strong><span className="muted small">{label}</span></div></div>
        ))}
      </div>
      <RegistryImport onDone={load} />
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title"><h2>{t("Користувачі")}</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t("Ім'я")}</th><th>{t("Пошта")}</th><th>{t("Група")}</th><th>{t("Остання активність")}</th><th>{t("Роль")}</th></tr></thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td><div className="row"><Avatar name={row.name} size={28} />{row.name}</div></td>
                  <td className="muted">{row.email}</td>
                  <td>{row.grp || '—'}</td>
                  <td className="muted">{row.last_seen ? timeAgo(row.last_seen) : t("ніколи")}</td>
                  <td>
                    {row.id === user.id ? <span className="badge accent">{t("Адмін (ви)")}</span> : (
                      <select className="input" value={row.role} onChange={(e) => setRole(row, e.target.value)}>
                        <option value="student">{t("Студент")}</option>
                        <option value="teacher">{t("Викладач")}</option>
                        <option value="admin">{t("Адмін")}</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
