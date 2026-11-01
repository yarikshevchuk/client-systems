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
      toast('Settings saved')
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!settings) return <Loading />
  const rows = [
    ['summaries_on', 'Summaries of lectures', 'Students can get the key points of a lecture.'],
    ['flashcards_on', 'Flashcards from lectures', 'Students can generate study cards from a lecture.'],
    ['ask_on', 'Questions about course materials', 'Answers only from the course materials. For graded labs the assistant gives hints, not solutions.'],
  ]

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>AI assistant</h2>
      </div>
      <p className="muted small">All AI features are off until you turn them on.</p>
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
      toast('Course saved')
      onCoursesChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    await api(`/courses/${id}`, { method: 'DELETE' })
    toast('Course deleted')
    onCoursesChanged()
    navigate('/')
  }

  if (user.role === 'student') return <p className="error">You do not have access to this page.</p>
  if (!data || !form) return <Loading />

  return (
    <>
      <Link to={`/courses/${id}`} className="crumb"><Icon name="left" size={16} />{data.course.title}</Link>
      <div className="page-head">
        <div>
          <h1>Course settings</h1>
          <p>Course information and AI rules.</p>
        </div>
      </div>
      <form className="card stack" onSubmit={save}>
        <h2>Course</h2>
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label className="field">
          <span className="label">Description</span>
          <textarea className="textarea" style={{ minHeight: 80 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="field">
          <span className="label">Student group</span>
          <input className="input" value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })} required />
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div><button type="submit" className="btn">Save course</button></div>
      </form>
      <AiSettings courseId={id} />
      <div className="card danger-zone">
        <h2>Delete course</h2>
        <p className="muted small" style={{ margin: '4px 0 14px' }}>Removes the course with all topics, materials, submissions, grades and discussions.</p>
        <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Delete this course</button>
      </div>
      {confirm && <Confirm title="Delete course" text={`Delete “${data.course.title}” and everything inside it? This cannot be undone.`} onConfirm={remove} onClose={() => setConfirm(false)} />}
    </>
  )
}
