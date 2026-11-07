import { useState } from 'react'
import { api, roleName } from '../api.js'
import { Avatar } from '../components/ui.jsx'
import { t } from '../i18n.js'

export default function Profile({ user, onChanged }) {
  const [form, setForm] = useState({ name: user.name, bio: user.bio || '', grp: user.grp || '' })
  const [password, setPassword] = useState({ old: '', new: '' })
  const [message, setMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  async function save(event) {
    event.preventDefault()
    try {
      onChanged(await api('/me', { method: 'PUT', body: form }))
      setMessage(t("Профіль збережено"))
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    try {
      await api('/me/password', { method: 'PUT', body: password })
      setPassword({ old: '', new: '' })
      setPasswordMessage(t("Пароль змінено"))
    } catch (err) {
      setPasswordMessage(err.message)
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
          <h2>{t("Профіль")}</h2>
          <label className="field">
            <span className="label">{t("Повне ім'я")}</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          {user.role === 'student' && (
            <label className="field">
              <span className="label">{t("Група")}</span>
              <input className="input" value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })} required />
            </label>
          )}
          <label className="field">
            <span className="label">{t("Про себе")}</span>
            <textarea className="textarea" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </label>
          {message && <p className="muted small">{message}</p>}
          <div><button type="submit" className="btn">{t("Зберегти профіль")}</button></div>
        </form>
        <form className="card stack" onSubmit={changePassword}>
          <h2>{t("Пароль")}</h2>
          <label className="field">
            <span className="label">{t("Поточний пароль")}</span>
            <input className="input" type="password" value={password.old} onChange={(e) => setPassword({ ...password, old: e.target.value })} required />
          </label>
          <label className="field">
            <span className="label">{t("Новий пароль")}</span>
            <input className="input" type="password" value={password.new} onChange={(e) => setPassword({ ...password, new: e.target.value })} placeholder={t("Щонайменше 4 символи")} required />
          </label>
          {passwordMessage && <p className="muted small">{passwordMessage}</p>}
          <div><button type="submit" className="btn">{t("Змінити пароль")}</button></div>
        </form>
      </div>
    </>
  )
}
