import { useState } from 'react'
import { api, roleName } from '../api.js'
import { Avatar, useToast } from '../components/ui.jsx'

export default function Profile({ user, onChanged }) {
  const [form, setForm] = useState({ name: user.name, bio: user.bio || '', grp: user.grp || '' })
  const [password, setPassword] = useState({ old: '', new: '' })
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      onChanged(await api('/me', { method: 'PUT', body: form }))
      toast('Профіль збережено')
    } catch (err) {
      setError(err.message)
    }
  }

  async function change(event) {
    event.preventDefault()
    setPasswordError('')
    try {
      await api('/me/password', { method: 'PUT', body: password })
      setPassword({ old: '', new: '' })
      toast('Пароль змінено')
    } catch (err) {
      setPasswordError(err.message)
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={user.name} size={64} />
          <div>
            <h1>{user.name}</h1>
            <p className="row" style={{ gap: 8, marginTop: 4 }}>
              <span className="badge accent">{roleName(user.role)}</span>
              <span>{user.email}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="grid two">
        <form className="card stack" onSubmit={save}>
          <h2>Профіль</h2>
          <label className="field">
            <span className="label">Повне ім'я</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          {user.role === 'student' && (
            <label className="field">
              <span className="label">Група</span>
              <input className="input" value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })} required />
            </label>
          )}
          <label className="field">
            <span className="label">Про себе</span>
            <textarea className="textarea" style={{ minHeight: 80 }} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </label>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div><button type="submit" className="btn">Зберегти профіль</button></div>
        </form>
        <form className="card stack" onSubmit={change}>
          <h2>Пароль</h2>
          <label className="field">
            <span className="label">Поточний пароль</span>
            <input className="input" type="password" value={password.old} onChange={(e) => setPassword({ ...password, old: e.target.value })} required />
          </label>
          <label className="field">
            <span className="label">Новий пароль</span>
            <input className="input" type="password" value={password.new} onChange={(e) => setPassword({ ...password, new: e.target.value })} placeholder="Щонайменше 4 символи" required />
          </label>
          {passwordError && <p className="error" style={{ margin: 0 }}>{passwordError}</p>}
          <div><button type="submit" className="btn">Змінити пароль</button></div>
        </form>
      </div>
    </>
  )
}
