import { useEffect, useState } from 'react'
import { api, timeAgo } from '../api.js'
import { Avatar, Icon, Loading, Select, useToast } from '../components/ui.jsx'

const ROLES = [{ value: 'student', label: 'Student' }, { value: 'teacher', label: 'Lecturer' }, { value: 'admin', label: 'Admin' }]

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
      toast(`${row.name} is now ${role === 'teacher' ? 'a lecturer' : role}`)
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (user.role !== 'admin') return <p className="error">You do not have access to this page.</p>
  if (!stats || !users) return <Loading />

  const tiles = [['Users', stats.users, 'users'], ['Students', stats.students, 'user'], ['Lecturers', stats.teachers, 'book'], ['Courses', stats.courses, 'layers'], ['Submissions', stats.submissions, 'file'], ['Messages', stats.messages, 'chat']]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p>Platform statistics and users.</p>
        </div>
      </div>
      <div className="grid three">
        {tiles.map(([label, value, icon]) => (
          <div className="card tile" key={label}><span className="icon-wrap"><Icon name={icon} /></span><div><strong>{value}</strong><span className="muted small">{label}</span></div></div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title"><h2>Users</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Group</th><th>Last seen</th><th>Role</th></tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td><div className="row"><Avatar name={row.name} size={28} />{row.name}</div></td>
                  <td className="muted">{row.email}</td>
                  <td>{row.grp || '—'}</td>
                  <td className="muted">{row.last_seen ? timeAgo(row.last_seen) : 'never'}</td>
                  <td style={{ minWidth: 150 }}>{row.id === user.id ? <span className="badge accent">Admin (you)</span> : <Select value={row.role} onChange={(role) => setRole(row, role)} options={ROLES} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
