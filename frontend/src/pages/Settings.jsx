import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { Icon, Loading } from '../components/ui.jsx'
import { t } from '../i18n.js'

const AI_OPTIONS = [
  ['summaries_on', t("Конспекти лекцій"), t("Студенти можуть отримати ключові думки лекції.")],
  ['flashcards_on', t("Картки з лекцій"), t("Студенти можуть створювати навчальні картки з лекції.")],
  ['ask_on', t("Запитання за матеріалами курсу"), t("Відповіді лише за матеріалами курсу. Для оцінюваних лабораторних помічник дає підказки, а не розв'язки.")],
]

function AiSettings({ courseId }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    api(`/courses/${courseId}/ai-settings`).then(setSettings)
  }, [courseId])

  async function change(key, value) {
    setSettings(await api(`/courses/${courseId}/ai-settings`, { method: 'PUT', body: { ...settings, [key]: value } }))
  }

  if (!settings) return <Loading />
  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>{t("AI-помічник")}</h2>
      </div>
      <p className="muted small">{t("Усі AI-функції вимкнені, доки ви їх не ввімкнете.")}</p>
      {AI_OPTIONS.map(([key, title, text]) => (
        <label className="toggle-row" key={key}>
          <div>
            <strong>{title}</strong>
            <div className="desc">{text}</div>
          </div>
          <input type="checkbox" className="switch" checked={settings[key]} onChange={(e) => change(key, e.target.checked)} />
        </label>
      ))}
    </div>
  )
}

export default function Settings({ user, onCoursesChanged }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api(`/courses/${id}`).then((data) => setForm({ title: data.course.title, description: data.course.description, grp: data.course.grp }))
  }, [id])

  async function save(event) {
    event.preventDefault()
    try {
      await api(`/courses/${id}`, { method: 'PUT', body: form })
      setMessage(t("Курс збережено"))
      onCoursesChanged()
    } catch (err) {
      setMessage(err.message)
    }
  }

  async function remove() {
    if (!confirm(t("Видалити «{title}» і все, що в ньому є? Цю дію не можна скасувати.", { title: form.title }))) return
    await api(`/courses/${id}`, { method: 'DELETE' })
    onCoursesChanged()
    navigate('/')
  }

  if (user.role === 'student') return <p className="error">{t("У вас немає доступу до цієї сторінки.")}</p>
  if (!form) return <Loading />

  return (
    <>
      <Link to={`/courses/${id}`} className="crumb"><Icon name="left" size={16} />{form.title}</Link>
      <div className="page-head"><h1>{t("Налаштування курсу")}</h1></div>
      <form className="card stack" onSubmit={save}>
        <h2>{t("Курс")}</h2>
        <label className="field">
          <span className="label">{t("Назва")}</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label className="field">
          <span className="label">{t("Опис")}</span>
          <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">{t("Група студентів")}</span>
          <input className="input" value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })} required />
        </label>
        {message && <p className="muted small">{message}</p>}
        <div><button type="submit" className="btn">{t("Зберегти курс")}</button></div>
      </form>
      <AiSettings courseId={id} />
      <div className="card danger-zone">
        <h2>{t("Видалити курс")}</h2>
        <p className="muted small" style={{ margin: '4px 0 14px' }}>{t("Видаляє курс разом з усіма темами, матеріалами, здачами, оцінками й обговореннями.")}</p>
        <button className="btn danger" onClick={remove}><Icon name="trash" size={16} />{t("Видалити цей курс")}</button>
      </div>
    </>
  )
}
