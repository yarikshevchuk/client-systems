import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmt, getToken, relative } from '../api.js'
import AiPanel from '../components/AiPanel.jsx'
import { Avatar, FileDrop, Icon, Stepper, useToast } from '../components/ui.jsx'

function Upload({ material, onDone }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const toast = useToast()
  const sub = material.submission
  const graded = sub && sub.grade !== null

  async function submit(event) {
    event.preventDefault()
    setError('')
    const form = new FormData()
    form.append('file', file)
    try {
      await api(`/materials/${material.id}/submit`, { method: 'POST', body: form })
      setFile(null)
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
            <strong>{sub.filename}</strong>
            <span className="muted small">Submitted {fmt(sub.submitted_at)}</span>
          </div>
          {graded && <strong style={{ fontSize: '1.2rem' }}>{sub.grade} <span className="muted small">/ {material.max_points}</span></strong>}
        </div>
      )}
      {!graded && (
        <form onSubmit={submit} className="stack">
          <FileDrop file={file} onChange={setFile} hint="PDF or DOCX, up to 20 MB" />
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div><button type="submit" className="btn" disabled={!file}><Icon name="upload" size={16} />{sub ? 'Submit again' : 'Submit'}</button></div>
        </form>
      )}
    </div>
  )
}

function Submissions({ material }) {
  const [rows, setRows] = useState(null)
  const [grades, setGrades] = useState({})
  const toast = useToast()

  function load() {
    api(`/materials/${material.id}/submissions`).then(setRows)
  }

  useEffect(load, [material.id])

  async function download(row) {
    const response = await fetch(`/api/submissions/${row.submission_id}/file`, { headers: { Authorization: `Bearer ${getToken()}` } })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await response.blob())
    link.download = row.filename
    link.click()
  }

  async function grade(row) {
    try {
      await api(`/submissions/${row.submission_id}/grade`, { method: 'PUT', body: { grade: Number(grades[row.submission_id]) } })
      setGrades({ ...grades, [row.submission_id]: '' })
      toast('Grade saved')
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!rows) return <p className="muted">Loading…</p>
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
            <tr><th>Student</th><th>Work</th><th>Grade (max {material.max_points})</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.student_id}>
                <td><div className="row"><Avatar name={row.name} size={28} />{row.name}</div></td>
                <td>
                  {row.submission_id ? (
                    <button className="link-btn row" onClick={() => download(row)}><Icon name="download" size={15} />{row.filename}</button>
                  ) : (
                    <span className="badge">Not submitted</span>
                  )}
                </td>
                <td>
                  {row.submission_id && (
                    <div className="row">
                      <Stepper
                        small
                        min={0}
                        max={material.max_points}
                        placeholder={row.grade === null ? '—' : String(row.grade)}
                        value={grades[row.submission_id] ?? ''}
                        onChange={(value) => setGrades({ ...grades, [row.submission_id]: value })}
                      />
                      <button className="btn sm" onClick={() => grade(row)} disabled={(grades[row.submission_id] ?? '') === ''}>Save</button>
                      {row.grade !== null && <span className="badge ok">{row.grade}</span>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AskLecturer({ material }) {
  const [text, setText] = useState('')
  const toast = useToast()

  async function send(event) {
    event.preventDefault()
    await api(`/courses/${material.course_id}/messages`, { method: 'POST', body: { text: `[${material.title}] ${text}`, is_question: true } })
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
  const [material, setMaterial] = useState(null)
  const [error, setError] = useState('')

  function load() {
    api(`/materials/${id}`).then(setMaterial).catch((err) => setError(err.message))
  }

  useEffect(() => {
    setMaterial(null)
    load()
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!material) return <p className="muted">Loading…</p>

  const lab = material.kind === 'lab'
  const due = lab ? relative(material.deadline) : null

  return (
    <>
      <Link to={`/courses/${material.course_id}`} className="crumb"><Icon name="left" size={16} />{material.topic_title}</Link>
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
      </div>
      <div className="card">
        <p className="reading">{material.content || 'No text yet.'}</p>
      </div>
      {lab && user.role === 'student' && <Upload material={material} onDone={load} />}
      {lab && user.role === 'student' && <AskLecturer material={material} />}
      {lab && user.role === 'teacher' && <Submissions material={material} />}
      {user.role === 'student' && <AiPanel material={material} ai={material.ai} />}
    </>
  )
}
