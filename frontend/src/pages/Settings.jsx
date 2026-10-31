import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

function AiSettings({ courseId }) {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/courses/${courseId}/ai-settings`).then(setSettings)
  }, [courseId])

  async function change(key, value) {
    setError('')
    try {
      setSettings(await api(`/courses/${courseId}/ai-settings`, { method: 'PUT', body: { ...settings, [key]: value } }))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!settings) return <p>Loading…</p>
  return (
    <div className="card">
      <h2>AI assistant</h2>
      <p className="muted">All AI features are off until you turn them on.</p>
      <label className="check">
        <input type="checkbox" checked={settings.summaries_on} onChange={(e) => change('summaries_on', e.target.checked)} />
        Summaries of lectures
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.ask_on} onChange={(e) => change('ask_on', e.target.checked)} />
        Questions about course materials (hints only for graded labs)
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function AddTopic({ courseId, onAdded }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  async function add(event) {
    event.preventDefault()
    setError('')
    try {
      await api(`/courses/${courseId}/topics`, { method: 'POST', body: { title } })
      setTitle('')
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="card" onSubmit={add}>
      <h2>Add a topic</h2>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Add topic</button>
    </form>
  )
}

function AddMaterial({ topics, onAdded }) {
  const [topicId, setTopicId] = useState('')
  const [kind, setKind] = useState('lecture')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [deadline, setDeadline] = useState('')
  const [maxPoints, setMaxPoints] = useState(10)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function add(event) {
    event.preventDefault()
    setError('')
    setDone(false)
    try {
      await api(`/topics/${topicId || topics[0].id}/materials`, {
        method: 'POST',
        body: { title, kind, content, deadline: deadline || null, max_points: Number(maxPoints) },
      })
      setTitle('')
      setContent('')
      setDone(true)
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  if (topics.length === 0) return <p className="muted">Add a topic first, then you can add materials.</p>
  return (
    <form className="card" onSubmit={add}>
      <h2>Add a material</h2>
      <label>
        Topic
        <select value={topicId || topics[0].id} onChange={(e) => setTopicId(e.target.value)}>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>{topic.title}</option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="lecture">Lecture</option>
          <option value="lab">Lab (graded)</option>
        </select>
      </label>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Text
        <textarea rows="6" value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      {kind === 'lab' && (
        <>
          <label>
            Deadline
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </label>
          <label>
            Max points
            <input type="number" min="1" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
          </label>
        </>
      )}
      {error && <p className="error">{error}</p>}
      {done && <p className="muted">Material added.</p>}
      <button type="submit">Add material</button>
    </form>
  )
}

export default function Settings({ user }) {
  const { id } = useParams()
  const [data, setData] = useState(null)

  function load() {
    api(`/courses/${id}`).then(setData)
  }

  useEffect(() => {
    if (user.role === 'teacher') load()
  }, [id, user.role])

  if (user.role !== 'teacher') return <p className="error">You do not have access to this page.</p>
  if (!data) return <p>Loading…</p>

  return (
    <>
      <p>
        <Link to={`/courses/${id}`}>← {data.course.title}</Link>
      </p>
      <h1>Course settings</h1>
      <AiSettings courseId={id} />
      <AddTopic courseId={id} onAdded={load} />
      <AddMaterial topics={data.topics} onAdded={load} />
    </>
  )
}
