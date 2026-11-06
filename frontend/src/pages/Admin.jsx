import { useEffect, useRef, useState } from 'react'
import { api, timeAgo } from '../api.js'
import { Avatar, Icon, Loading, Select, useToast } from '../components/ui.jsx'

const ROLES = [{ value: 'student', label: 'Студент' }, { value: 'teacher', label: 'Викладач' }, { value: 'admin', label: 'Адмін' }]

function RegistryImport({ onDone }) {
  const input = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function upload(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setError('')
    const form = new FormData()
    form.append('file', file)
    try {
      setResult(await api('/admin/import', { method: 'POST', body: form }))
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  function saveAccounts() {
    const rows = [['Номер квитка', 'ПІБ', 'Група', 'Роль', 'Пошта', 'Пароль'], ...result.created.map((r) => [r.ticket, r.name, r.group, r.role, r.email, r.password])]
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }))
    link.download = 'oblikovi-zapysy.csv'
    link.click()
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-title"><span className="icon-wrap"><Icon name="upload" size={16} /></span><h2>Імпорт реєстру деканату</h2></div>
      <p className="muted small">CSV з колонками: номер студентського квитка, ПІБ, група (необов'язково четверта — роль student або teacher). Для кожного рядка створюється обліковий запис із поштою й паролем, роль і група призначаються автоматично.</p>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={upload} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => input.current.click()}><Icon name="upload" size={16} />Завантажити CSV</button>
        {result && result.created.length > 0 && <button className="btn secondary" onClick={saveAccounts}><Icon name="download" size={16} />Зберегти паролі ({result.created.length})</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <div style={{ marginTop: 14 }}>
          <p><b>Створено: {result.created.length}</b>{result.skipped.length > 0 && <span className="muted"> · пропущено: {result.skipped.length}</span>}</p>
          {result.created.length > 0 && <p className="muted small">Паролі показуються лише зараз. Збережіть файл і передайте студентам.</p>}
          {result.skipped.map((row, index) => <div key={index} className="muted small">«{row.row}» — {row.reason}</div>)}
        </div>
      )}
    </div>
  )
}

export default function Admin({ user }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const toast = useToast()

  function load() {
    api('/admin/stats').then(setStats)
    api('/admin/users').then(setUsers)
  }

  useEffect(() => {
    if (user.role === 'admin') load()
  }, [user.role])

  async function setRole(row, role) {
    try {
      await api(`/admin/users/${row.id}`, { method: 'PUT', body: { role } })
      toast(`${row.name}: нова роль — ${{ student: 'студент', teacher: 'викладач', admin: 'адмін' }[role]}`)
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (user.role !== 'admin') return <p className="error">У вас немає доступу до цієї сторінки.</p>
  if (!stats || !users) return <Loading />

  const tiles = [['Користувачі', stats.users, 'users'], ['Студенти', stats.students, 'user'], ['Викладачі', stats.teachers, 'book'], ['Курси', stats.courses, 'layers'], ['Здані роботи', stats.submissions, 'file'], ['Повідомлення', stats.messages, 'chat']]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Адміністрування</h1>
        </div>
      </div>
      <div className="grid three">
        {tiles.map(([label, value, icon]) => (
          <div className="card tile" key={label}><span className="icon-wrap"><Icon name={icon} /></span><div><strong>{value}</strong><span className="muted small">{label}</span></div></div>
        ))}
      </div>
      <RegistryImport onDone={load} />
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title"><h2>Користувачі</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ім'я</th><th>Пошта</th><th>Група</th><th>Остання активність</th><th>Роль</th></tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td><div className="row"><Avatar name={row.name} size={28} />{row.name}</div></td>
                  <td className="muted">{row.email}</td>
                  <td>{row.grp || '—'}</td>
                  <td className="muted">{row.last_seen ? timeAgo(row.last_seen) : 'ніколи'}</td>
                  <td style={{ minWidth: 150 }}>{row.id === user.id ? <span className="badge accent">Адмін (ви)</span> : <Select value={row.role} onChange={(role) => setRole(row, role)} options={ROLES} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
