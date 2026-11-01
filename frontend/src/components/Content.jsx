import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmt, relative } from '../api.js'
import { colorFor, Confirm, Empty, Icon, Menu, Modal, useToast } from './ui.jsx'
import MaterialForm from './MaterialForm.jsx'

function TopicForm({ courseId, topic, onSaved, onClose }) {
  const [title, setTitle] = useState(topic ? topic.title : '')
  const [error, setError] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      if (topic) await api(`/topics/${topic.id}`, { method: 'PUT', body: { title } })
      else await api(`/courses/${courseId}/topics`, { method: 'POST', body: { title } })
      toast(topic ? 'Topic renamed' : 'Topic added')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={topic ? 'Rename topic' : 'Add a topic'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Trees" autoFocus required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">{topic ? 'Save' : 'Add topic'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Status({ material }) {
  if (material.kind !== 'lab') return null
  if (material.grade !== null && material.grade !== undefined) return <span className="badge ok">{material.grade} / {material.max_points}</span>
  if (material.submission_id) return <span className="badge accent">Submitted</span>
  const due = relative(material.deadline)
  return due ? <span className={`badge ${due.tone}`}>{due.text}</span> : null
}

export default function Content({ data, canManage, student, reload }) {
  const [dialog, setDialog] = useState(null)
  const toast = useToast()
  const color = colorFor(data.course.id)

  async function call(path, options, message) {
    try {
      await api(path, options)
      if (message) toast(message)
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  return (
    <>
      {canManage && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn secondary" onClick={() => setDialog({ type: 'topic' })}><Icon name="plus" size={16} />Add topic</button>
        </div>
      )}
      {data.topics.length === 0 && <Empty icon="layers">No topics yet.{canManage ? ' Add the first one.' : ''}</Empty>}
      {data.topics.map((topic, index) => (
        <section className="topic" key={topic.id} style={index === 0 ? { marginTop: 0 } : undefined}>
          <div className="topic-title">
            <span className="num" style={{ background: color }}>{index + 1}</span>
            <h2>{topic.title.replace(/^Topic \d+\.\s*/, '')}</h2>
            {canManage && (
              <div className="push">
                <Menu
                  label="Topic actions"
                  items={[
                    { label: 'Add material', onClick: () => setDialog({ type: 'material', topic }) },
                    { label: 'Rename topic', onClick: () => setDialog({ type: 'topic', topic }) },
                    index > 0 && { label: 'Move up', onClick: () => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction: 'up' } }) },
                    index < data.topics.length - 1 && { label: 'Move down', onClick: () => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction: 'down' } }) },
                    { label: 'Delete topic', danger: true, onClick: () => setDialog({ type: 'delete-topic', topic }) },
                  ]}
                />
              </div>
            )}
          </div>
          {topic.materials.length === 0 && <p className="muted small">No materials yet.</p>}
          {topic.materials.map((material) => (
            <div className="item" key={material.id}>
              <Link to={`/materials/${material.id}`} className="item-link">
                <span className={material.kind === 'lab' ? 'icon-wrap accent' : 'icon-wrap'}>
                  <Icon name={material.kind === 'lab' ? 'file' : 'book'} size={20} />
                </span>
                <div className="grow">
                  <strong>{material.title}</strong>
                  <span className="muted small">
                    {material.kind === 'lab' ? `Lab · due ${fmt(material.deadline)} · ${material.max_points} points` : 'Lecture'}
                  </span>
                </div>
              </Link>
              <div className="side">
                {student && <Status material={material} />}
                {canManage && (
                  <Menu
                    label="Material actions"
                    items={[
                      { label: 'Edit', onClick: async () => setDialog({ type: 'material', topic, material: await api(`/materials/${material.id}`) }) },
                      { label: 'Delete', danger: true, onClick: () => setDialog({ type: 'delete-material', material }) },
                    ]}
                  />
                )}
              </div>
            </div>
          ))}
        </section>
      ))}

      {dialog && dialog.type === 'topic' && <TopicForm courseId={data.course.id} topic={dialog.topic} onSaved={reload} onClose={() => setDialog(null)} />}
      {dialog && dialog.type === 'material' && (
        <MaterialForm topicId={dialog.topic.id} material={dialog.material || null} onSaved={reload} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog.type === 'delete-topic' && (
        <Confirm title="Delete topic" text={`Delete “${dialog.topic.title}” with all its materials, submissions and grades? This cannot be undone.`} onConfirm={() => call(`/topics/${dialog.topic.id}`, { method: 'DELETE' }, 'Topic deleted')} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog.type === 'delete-material' && (
        <Confirm title="Delete material" text={`Delete “${dialog.material.title}” with its submissions and grades? This cannot be undone.`} onConfirm={() => call(`/materials/${dialog.material.id}`, { method: 'DELETE' }, 'Material deleted')} onClose={() => setDialog(null)} />
      )}
    </>
  )
}
