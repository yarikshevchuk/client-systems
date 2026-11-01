import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, download, fmt, relative, timeAgo } from '../api.js'
import AiPanel from '../components/AiPanel.jsx'
import MaterialForm from '../components/MaterialForm.jsx'
import Notes from '../components/Notes.jsx'
import { Avatar, Confirm, FileDrop, Icon, Loading, Menu, Modal, Stepper, useToast } from '../components/ui.jsx'

const formatSize = (bytes) => (bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB')

function Attachments({ material, canManage, reload }) {
  const input = useRef(null)
  const toast = useToast()

  async function add(event) {
    const file = event.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      await api(`/materials/${material.id}/attachments`, { method: 'POST', body: form })
      toast('File attached')
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
    event.target.value = ''
  }

  if (!canManage && material.attachments.length === 0) return null
  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="file" size={16} /></span>
        <h2>Files</h2>
        {canManage && (
          <div className="push">
            <input ref={input} type="file" hidden onChange={add} />
            <button className="btn secondary sm" onClick={() => input.current.click()}><Icon name="upload" size={14} />Attach file</button>
          </div>
        )}
      </div>
      {material.attachments.length === 0 && <p className="muted small">No files yet.</p>}
      {material.attachments.map((file) => (
        <div className="file-row" key={file.id}>
          <Icon name="file" size={18} />
          <button className="link-btn grow" onClick={() => download(`/attachments/${file.id}/file`, file.filename)}>{file.filename}</button>
          <span className="muted small">{formatSize(file.size)}</span>
          {canManage && (
            <button className="icon-btn" aria-label="Remove file" onClick={async () => { await api(`/attachments/${file.id}`, { method: 'DELETE' }); reload() }}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function Upload({ material, onDone }) {
  const [file, setFile] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const toast = useToast()
  const sub = material.submission
  const graded = sub && sub.grade !== null

  async function submit(event) {
    event.preventDefault()
    setError('')
    const form = new FormData()
    form.append('file', file)
    form.append('comment', comment)
    try {
      await api(`/materials/${material.id}/submit`, { method: 'POST', body: form })
      setFile(null)
      setComment('')
      toast('Work submitted')
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="upload" size={16} /></span>
        <h2>Your work</h2>
        {graded ? <span className="badge ok">Graded</span> : sub ? <span className="badge accent">Submitted</span> : <span className="badge">Not submitted</span>}
      </div>
      {sub && (
        <div className="file-chosen" style={{ marginBottom: 14 }}>
          <span className="icon-wrap"><Icon name="file" size={20} /></span>
          <div className="grow">
            <button className="link-btn" onClick={() => download(`/submissions/${sub.id}/file`, sub.filename)}><strong>{sub.filename}</strong></button>
            <span className="muted small">Submitted {fmt(sub.submitted_at)}{sub.comment ? ` · “${sub.comment}”` : ''}</span>
          </div>
          {graded && <strong style={{ fontSize: '1.3rem' }}>{sub.grade} <span className="muted small">/ {material.max_points}</span></strong>}
        </div>
      )}
      {graded && sub.feedback && (
        <div className="feedback">
          <span className="muted small">Lecturer's feedback</span>
          <p>{sub.feedback}</p>
        </div>
      )}
      {!graded && (
        <form onSubmit={submit} className="stack">
          <FileDrop file={file} onChange={setFile} hint="PDF or DOCX, up to 20 MB" />
          <label className="field">
            <span className="label">Comment for the lecturer (optional)</span>
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything the lecturer should know" />
          </label>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div><button type="submit" className="btn" disabled={!file}><Icon name="upload" size={16} />{sub ? 'Submit again' : 'Submit'}</button></div>
        </form>
      )}
    </div>
  )
}

function GradeDialog({ row, material, onSaved, onClose }) {
  const [grade, setGrade] = useState(row.grade === null ? '' : row.grade)
  const [feedback, setFeedback] = useState(row.feedback || '')
  const [error, setError] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      await api(`/submissions/${row.submission_id}/grade`, { method: 'PUT', body: { grade: Number(grade), feedback } })
      toast('Grade saved')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={`Grade: ${row.name}`} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="file-chosen">
          <span className="icon-wrap"><Icon name="file" size={20} /></span>
          <div className="grow">
            <button type="button" className="link-btn" onClick={() => download(`/submissions/${row.submission_id}/file`, row.filename)}><strong>{row.filename}</strong></button>
            <span className="muted small">Submitted {fmt(row.submitted_at)}</span>
          </div>
        </div>
        {row.comment && <p className="muted">Student's comment: “{row.comment}”</p>}
        <div className="field">
          <span className="label">Grade (max {material.max_points})</span>
          <Stepper value={grade} onChange={setGrade} min={0} max={material.max_points} />
        </div>
        <label className="field">
          <span className="label">Feedback</span>
          <textarea className="textarea" style={{ minHeight: 90 }} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What was good and what to improve" />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={grade === ''}>Save grade</button>
        </div>
      </form>
    </Modal>
  )
}

function Submissions({ material }) {
  const [rows, setRows] = useState(null)
  const [grading, setGrading] = useState(null)

  function load() {
    api(`/materials/${material.id}/submissions`).then(setRows)
  }

  useEffect(load, [material.id])

  if (!rows) return <Loading />
  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="users" size={16} /></span>
        <h2>Submissions</h2>
        <span className="badge">{rows.filter((row) => row.submission_id).length} / {rows.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Student</th><th>Work</th><th>Grade</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.student_id}>
                <td><div className="row"><Avatar name={row.name} size={28} />{row.name}</div></td>
                <td>
                  {row.submission_id ? (
                    <div>
                      <button className="link-btn row" onClick={() => download(`/submissions/${row.submission_id}/file`, row.filename)}><Icon name="download" size={15} />{row.filename}</button>
                      <span className="muted small">{timeAgo(row.submitted_at)}</span>
                    </div>
                  ) : <span className="badge">Not submitted</span>}
                </td>
                <td>{row.grade !== null ? <span className="badge ok">{row.grade} / {material.max_points}</span> : row.submission_id ? <span className="badge warn">Waiting</span> : '—'}</td>
                <td>{row.submission_id && <button className="btn secondary sm" onClick={() => setGrading(row)}>{row.grade !== null ? 'Edit grade' : 'Grade'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grading && <GradeDialog row={grading} material={material} onSaved={load} onClose={() => setGrading(null)} />}
    </div>
  )
}

function AskLecturer({ material }) {
  const [text, setText] = useState('')
  const toast = useToast()

  async function send(event) {
    event.preventDefault()
    await api(`/courses/${material.course_id}/messages`, { method: 'POST', body: { channel: 'qa', text: `[${material.title}] ${text}` } })
    setText('')
    toast('Question sent to the course Q&A')
  }

  return (
    <form className="card" onSubmit={send}>
      <div className="card-title">
        <span className="icon-wrap"><Icon name="help" size={16} /></span>
        <h2>Questions about this lab</h2>
      </div>
      <div className="row">
        <input className="input" placeholder="Ask the lecturer…" value={text} onChange={(e) => setText(e.target.value)} required />
        <button type="submit" className="btn"><Icon name="send" size={16} />Send</button>
      </div>
    </form>
  )
}

export default function Material({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [material, setMaterial] = useState(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const toast = useToast()

  function load() {
    api(`/materials/${id}`).then(setMaterial).catch((err) => setError(err.message))
  }

  useEffect(() => {
    setMaterial(null)
    load()
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!material) return <Loading />

  const lab = material.kind === 'lab'
  const due = lab ? relative(material.deadline) : null
  const student = user.role === 'student'

  async function remove() {
    try {
      await api(`/materials/${material.id}`, { method: 'DELETE' })
      toast('Material deleted')
      navigate(`/courses/${material.course_id}`)
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  return (
    <>
      <Link to={`/courses/${material.course_id}`} className="crumb"><Icon name="left" size={16} />{material.course_title} · {material.topic_title}</Link>
      <div className="page-head">
        <div>
          <h1>{material.title}</h1>
          <p className="row wrap" style={{ gap: 8, marginTop: 10 }}>
            <span className={lab ? 'badge accent' : 'badge'}>{lab ? 'Lab' : 'Lecture'}</span>
            {lab && <span className="badge"><Icon name="calendar" size={13} />{fmt(material.deadline)}</span>}
            {lab && <span className="badge"><Icon name="award" size={13} />{material.max_points} points</span>}
            {due && <span className={`badge ${due.tone}`}>{due.text}</span>}
          </p>
        </div>
        {material.can_manage && (
          <Menu items={[{ label: 'Edit material', onClick: () => setDialog('edit') }, { label: 'Delete material', danger: true, onClick: () => setDialog('delete') }]} />
        )}
      </div>
      <div className="card">
        <p className="reading">{material.content || 'No text yet.'}</p>
      </div>
      <Attachments material={material} canManage={material.can_manage} reload={load} />
      {lab && student && <Upload material={material} onDone={load} />}
      {lab && student && <AskLecturer material={material} />}
      {lab && material.can_manage && <Submissions material={material} />}
      {student && <Notes key={material.id} materialId={material.id} initial={material.note} />}
      {student && <AiPanel material={material} ai={material.ai} />}
      {dialog === 'edit' && <MaterialForm material={material} onSaved={load} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <Confirm title="Delete material" text={`Delete “${material.title}” with its submissions and grades? This cannot be undone.`} onConfirm={remove} onClose={() => setDialog(null)} />}
    </>
  )
}
