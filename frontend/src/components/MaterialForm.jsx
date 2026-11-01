import { useState } from 'react'
import { api } from '../api.js'
import { DateTimeField, Modal, Segmented, Stepper, useToast } from './ui.jsx'

const toInput = (value) => (value ? String(value).slice(0, 16) : '')

export default function MaterialForm({ topicId, material, onSaved, onClose }) {
  const [kind, setKind] = useState(material ? material.kind : 'lecture')
  const [title, setTitle] = useState(material ? material.title : '')
  const [content, setContent] = useState(material ? material.content : '')
  const [deadline, setDeadline] = useState(material ? toInput(material.deadline) : '')
  const [maxPoints, setMaxPoints] = useState(material && material.max_points ? material.max_points : 10)
  const [error, setError] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    setError('')
    if (kind === 'lab' && !deadline) {
      setError('Pick a deadline for the lab')
      return
    }
    const body = { title, kind, content, deadline: deadline || null, max_points: maxPoints }
    try {
      if (material) await api(`/materials/${material.id}`, { method: 'PUT', body })
      else await api(`/topics/${topicId}/materials`, { method: 'POST', body })
      toast(material ? 'Material saved' : 'Material added')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={material ? 'Edit material' : 'Add a material'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="field">
          <span className="label">Type</span>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'lecture', label: 'Lecture' }, { value: 'lab', label: 'Lab (graded)' }]} />
        </div>
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture 4. Binary trees" autoFocus required />
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
          <button type="submit" className="btn">{material ? 'Save' : 'Add material'}</button>
        </div>
      </form>
    </Modal>
  )
}
