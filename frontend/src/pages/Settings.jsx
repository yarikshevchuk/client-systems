import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { Confirm, Icon, Loading, Toggle, useToast } from '../components/ui.jsx'

function AiSettings({ courseId }) {
  const [settings, setSettings] = useState(null)
  const toast = useToast()

  useEffect(() => {
    api(`/courses/${courseId}/ai-settings`).then(setSettings)
  }, [courseId])

  async function change(key, value) {
    try {
      setSettings(await api(`/courses/${courseId}/ai-settings`, { method: 'PUT', body: { ...settings, [key]: value } }))
      toast('Налаштування збережено')
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!settings) return <Loading />
  const rows = [
    ['summaries_on', 'Конспекти лекцій', 'Студенти можуть отримати ключові думки лекції.'],
    ['flashcards_on', 'Картки з лекцій', 'Студенти можуть створювати навчальні картки з лекції.'],
    ['ask_on', 'Запитання за матеріалами курсу', 'Відповіді лише за матеріалами курсу. Для оцінюваних лабораторних помічник дає підказки, а не розв\'язки.'],
  ]

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>AI-помічник</h2>
      </div>
      <p className="muted small">Усі AI-функції вимкнені, доки ви їх не ввімкнете.</p>
      {rows.map(([key, title, text]) => (
        <div className="toggle-row" key={key}>
          <div>
            <strong>{title}</strong>
            <div className="desc">{text}</div>
          </div>
          <Toggle label={title} checked={settings[key]} onChange={(value) => change(key, value)} />
        </div>
      ))}
    </div>
  )
}

export default function Settings({ user, onCoursesChanged }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    if (user.role === 'student') return
    api(`/courses/${id}`).then((result) => {
      setData(result)
      setForm({ title: result.course.title, description: result.course.description, grp: result.course.grp })
    })
  }, [id, user.role])

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      await api(`/courses/${id}`, { method: 'PUT', body: form })
      toast('Курс збережено')
      onCoursesChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    await api(`/courses/${id}`, { method: 'DELETE' })
    toast('Курс видалено')
    onCoursesChanged()
    navigate('/')
  }

  if (user.role === 'student') return <p className="error">У вас немає доступу до цієї сторінки.</p>
  if (!data || !form) return <Loading />

  return (
    <>
      <Link to={`/courses/${id}`} className="crumb"><Icon name="left" size={16} />{data.course.title}</Link>
      <div className="page-head">
        <div>
          <h1>Налаштування курсу</h1>
        </div>
      </div>
      <form className="card stack" onSubmit={save}>
        <h2>Курс</h2>
        <label className="field">
          <span className="label">Назва</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label className="field">
          <span className="label">Опис</span>
          <textarea className="textarea" style={{ minHeight: 80 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">Група студентів</span>
          <input className="input" value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })} required />
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div><button type="submit" className="btn">Зберегти курс</button></div>
      </form>
      <AiSettings courseId={id} />
      <div className="card danger-zone">
        <h2>Видалити курс</h2>
        <p className="muted small" style={{ margin: '4px 0 14px' }}>Видаляє курс разом з усіма темами, матеріалами, здачами, оцінками й обговореннями.</p>
        <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Видалити цей курс</button>
      </div>
      {confirm && <Confirm title="Видалити курс" text={`Видалити «${data.course.title}» і все, що в ньому є? Цю дію не можна скасувати.`} onConfirm={remove} onClose={() => setConfirm(false)} />}
    </>
  )
}
