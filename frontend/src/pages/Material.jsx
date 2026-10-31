import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmt, getToken } from '../api.js'
import AiPanel from '../components/AiPanel.jsx'

function Upload({ material, onDone }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    const form = new FormData()
    form.append('file', file)
    try {
      await api(`/materials/${material.id}/submit`, { method: 'POST', body: form })
      setFile(null)
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  const sub = material.submission
  return (
    <div className="card">
      <h2>Your work</h2>
      {sub && (
        <p>
          Submitted <strong>{sub.filename}</strong> at {fmt(sub.submitted_at)}.{' '}
          {sub.grade !== null ? `Grade: ${sub.grade} / ${material.max_points}` : 'Waiting for a grade.'}
        </p>
      )}
      {!(sub && sub.grade !== null) && (
        <form onSubmit={submit}>
          <label>
            Report (PDF or DOCX, up to 20 MB)
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={!file}>{sub ? 'Submit again' : 'Submit'}</button>
        </form>
      )}
    </div>
  )
}

function Submissions({ material }) {
  const [rows, setRows] = useState(null)
  const [grades, setGrades] = useState({})
  const [error, setError] = useState('')

  function load() {
    api(`/materials/${material.id}/submissions`).then(setRows)
  }

  useEffect(load, [material.id])

  async function download(row) {
    const response = await fetch(`/api/submissions/${row.submission_id}/file`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await response.blob())
    link.download = row.filename
    link.click()
  }

  async function grade(row) {
    setError('')
    try {
      await api(`/submissions/${row.submission_id}/grade`, {
        method: 'PUT',
        body: { grade: Number(grades[row.submission_id]) },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!rows) return <p>Loading…</p>
  return (
    <div className="card">
      <h2>Submissions</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Submitted</th>
            <th>Grade (max {material.max_points})</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.student_id}>
              <td>{row.name}</td>
              <td>
                {row.submission_id ? (
                  <button className="link" onClick={() => download(row)}>{row.filename}</button>
                ) : (
                  'Not submitted'
                )}
              </td>
              <td>
                {row.submission_id && (
                  <div className="row">
                    <input
                      className="short"
                      type="number"
                      min="0"
                      max={material.max_points}
                      placeholder={row.grade === null ? '—' : String(row.grade)}
                      value={grades[row.submission_id] ?? ''}
                      onChange={(e) => setGrades({ ...grades, [row.submission_id]: e.target.value })}
                    />
                    <button className="secondary" onClick={() => grade(row)} disabled={grades[row.submission_id] === undefined || grades[row.submission_id] === ''}>
                      Save
                    </button>
                    {row.grade !== null && <span className="tag">{row.grade}</span>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AskLecturer({ material }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  async function send(event) {
    event.preventDefault()
    await api(`/courses/${material.course_id}/messages`, {
      method: 'POST',
      body: { text: `[${material.title}] ${text}`, is_question: true },
    })
    setText('')
    setSent(true)
  }

  return (
    <form className="card" onSubmit={send}>
      <h2>Questions about this lab</h2>
      <input placeholder="Ask the lecturer…" value={text} onChange={(e) => { setText(e.target.value); setSent(false) }} required />
      <button type="submit">Send</button>
      {sent && <p className="muted">Sent to the course Q&amp;A.</p>}
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
  if (!material) return <p>Loading…</p>

  return (
    <>
      <p>
        <Link to={`/courses/${material.course_id}`}>← {material.topic_title}</Link>
      </p>
      <h1>{material.title}</h1>
      {material.kind === 'lab' && (
        <p className="muted">
          Deadline {fmt(material.deadline)} · max {material.max_points} points
        </p>
      )}
      <div className="card">
        <p className="text">{material.content}</p>
      </div>
      {material.kind === 'lab' && user.role === 'student' && <Upload material={material} onDone={load} />}
      {material.kind === 'lab' && user.role === 'student' && <AskLecturer material={material} />}
      {material.kind === 'lab' && user.role === 'teacher' && <Submissions material={material} />}
      {user.role === 'student' && <AiPanel material={material} ai={material.ai} />}
    </>
  )
}
