import { useEffect, useState } from 'react'
import { api, timeAgo } from '../api.js'
import { Avatar, Icon, Loading, Select, useToast } from '../components/ui.jsx'

const ROLES = [{ value: 'student', label: 'Студент' }, { value: 'teacher', label: 'Викладач' }, { value: 'admin', label: 'Адмін' }]

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
          <p>Статистика платформи та користувачі.</p>
        </div>
      </div>
      <div className="grid three">
        {tiles.map(([label, value, icon]) => (
          <div className="card tile" key={label}><span className="icon-wrap"><Icon name={icon} /></span><div><strong>{value}</strong><span className="muted small">{label}</span></div></div>
        ))}
      </div>
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
