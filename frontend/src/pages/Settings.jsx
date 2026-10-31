import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { DateTimeField, Icon, Modal, Segmented, Select, Stepper, Toggle, useToast } from '../components/ui.jsx'

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

  if (!settings) return <p className="muted">Loading…</p>
  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>AI assistant</h2>
      </div>
      <p className="muted small">All AI features are off until you turn them on.</p>
      <div className="toggle-row">
        <div>
          <strong>Summaries of lectures</strong>
          <div className="desc">Students can get key points of a lecture.</div>
        </div>
        <Toggle label="Summaries of lectures" checked={settings.summaries_on} onChange={(value) => change('summaries_on', value)} />
      </div>
      <div className="toggle-row">
        <div>
          <strong>Questions about course materials</strong>
          <div className="desc">Answers only from the course materials. For graded labs the assistant gives hints, not solutions.</div>
        </div>
        <Toggle label="Questions about course materials" checked={settings.ask_on} onChange={(value) => change('ask_on', value)} />
      </div>
    </div>
  )
}

function AddTopic({ courseId, onClose, onAdded }) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const toast = useToast()

  async function add(event) {
    event.preventDefault()
    setError('')
    try {
      await api(`/courses/${courseId}/topics`, { method: 'POST', body: { title } })
      toast('Topic added')
      onAdded()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Add a topic" onClose={onClose}>
      <form onSubmit={add} className="stack">
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Topic 4. Trees" autoFocus required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Add topic</button>
        </div>
      </form>
    </Modal>
  )
}

function AddMaterial({ topics, onClose, onAdded }) {
  const [topicId, setTopicId] = useState(topics[0].id)
  const [kind, setKind] = useState('lecture')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [deadline, setDeadline] = useState('')
  const [maxPoints, setMaxPoints] = useState(10)
  const [error, setError] = useState('')
  const toast = useToast()

  async function add(event) {
    event.preventDefault()
    setError('')
    if (kind === 'lab' && !deadline) {
      setError('Pick a deadline for the lab')
      return
    }
    try {
      await api(`/topics/${topicId}/materials`, {
        method: 'POST',
        body: { title, kind, content, deadline: deadline || null, max_points: maxPoints },
      })
      toast('Material added')
      onAdded()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Add a material" onClose={onClose}>
      <form onSubmit={add} className="stack">
        <div className="field">
          <span className="label">Topic</span>
          <Select value={topicId} onChange={setTopicId} options={topics.map((topic) => ({ value: topic.id, label: topic.title }))} />
        </div>
        <div className="field">
          <span className="label">Type</span>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'lecture', label: 'Lecture' }, { value: 'lab', label: 'Lab (graded)' }]} />
        </div>
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture 4. Binary trees" required />
        </label>
        <label className="field">
          <span className="label">Text</span>
          <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Lecture text or lab task" />
        </label>
        {kind === 'lab' && (
          <>
            <div className="field">
              <span className="label">Deadline</span>
              <DateTimeField value={deadline} onChange={setDeadline} />
            </div>
            <div className="field">
              <span className="label">Max points</span>
              <Stepper value={maxPoints} onChange={(value) => setMaxPoints(value === '' ? 1 : value)} min={1} max={100} />
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Add material</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Settings({ user }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [dialog, setDialog] = useState(null)

  function load() {
    api(`/courses/${id}`).then(setData)
  }

  useEffect(() => {
    if (user.role === 'teacher') load()
  }, [id, user.role])

  if (user.role !== 'teacher') return <p className="error">You do not have access to this page.</p>
  if (!data) return <p className="muted">Loading…</p>

  return (
    <>
      <Link to={`/courses/${id}`} className="crumb"><Icon name="left" size={16} />{data.course.title}</Link>
      <div className="page-head">
        <div>
          <h1>Course settings</h1>
          <p>Content and AI rules for this course.</p>
        </div>
      </div>
      <AiSettings courseId={id} />
      <div className="card">
        <div className="card-title">
          <span className="icon-wrap"><Icon name="layers" size={16} /></span>
          <h2>Content</h2>
        </div>
        <p className="muted small" style={{ marginBottom: 14 }}>{data.topics.length} topics · {data.topics.reduce((sum, topic) => sum + topic.materials.length, 0)} materials</p>
        <div className="row wrap">
          <button className="btn secondary" onClick={() => setDialog('topic')}><Icon name="plus" size={16} />Add topic</button>
          <button className="btn" onClick={() => setDialog('material')} disabled={data.topics.length === 0}><Icon name="plus" size={16} />Add material</button>
        </div>
        {data.topics.length === 0 && <p className="muted small" style={{ marginTop: 12 }}>Add a topic first, then you can add materials.</p>}
      </div>
      {dialog === 'topic' && <AddTopic courseId={id} onClose={() => setDialog(null)} onAdded={load} />}
      {dialog === 'material' && <AddMaterial topics={data.topics} onClose={() => setDialog(null)} onAdded={load} />}
    </>
  )
}
