import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmt, timeAgo } from '../api.js'
import { Avatar, Icon, Loading, ProgressBar, Stepper } from './ui.jsx'

function Simulator({ data }) {
  const [target, setTarget] = useState(75)
  const remaining = data.total_max - data.graded_max
  const needed = Math.ceil((target / 100) * data.total_max) - data.earned
  const best = data.total_max ? Math.round((100 * (data.earned + remaining)) / data.total_max) : 0
  let text
  let tone = 'ok'
  if (needed <= 0) {
    text = `You have already reached ${target}% of the course points.`
  } else if (needed > remaining) {
    text = `${target}% is not reachable. The best you can get is ${best}%.`
    tone = 'bad'
  } else {
    text = `You need ${needed} more ${needed === 1 ? 'point' : 'points'} out of ${remaining} that are still open, about ${Math.round((100 * needed) / remaining)}% of the remaining labs.`
    tone = needed / remaining > 0.8 ? 'warn' : 'ok'
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="award" size={16} /></span>
        <h2>What do I need to get…</h2>
      </div>
      <div className="row wrap">
        <span>I want to finish with</span>
        <Stepper value={target} onChange={(value) => setTarget(value === '' ? 0 : value)} min={0} max={100} />
        <span>% of all course points</span>
      </div>
      <p className={`sim ${tone}`}>{text}</p>
    </div>
  )
}

export function StudentGrades({ courseId, color }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api(`/courses/${courseId}/grades`).then(setData)
  }, [courseId])

  if (!data) return <Loading />
  return (
    <>
      <div className="card">
        <div className="card-title">
          <span className="icon-wrap"><Icon name="award" size={16} /></span>
          <h2>Grade forecast</h2>
        </div>
        <ProgressBar percent={data.total_max ? (100 * data.earned) / data.total_max : 0} color={color} />
        <dl className="stats" style={{ margin: '14px 0 0' }}>
          <div className="stat"><dt>Earned</dt><dd>{data.earned}</dd></div>
          <div className="stat"><dt>On graded work</dt><dd>{data.percent_graded === null ? '—' : `${data.percent_graded}%`}</dd></div>
          <div className="stat"><dt>Max possible</dt><dd>{data.total_max}</dd></div>
        </dl>
      </div>
      <Simulator data={data} />
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Lab</th><th>Deadline</th><th>Status</th><th>Grade</th></tr>
            </thead>
            <tbody>
              {data.labs.map((lab) => (
                <tr key={lab.id}>
                  <td>
                    <Link className="link-btn" to={`/materials/${lab.id}`}>{lab.title}</Link>
                    {lab.feedback && <div className="muted small">“{lab.feedback}”</div>}
                  </td>
                  <td className="muted">{fmt(lab.deadline)}</td>
                  <td>{lab.grade !== null ? <span className="badge ok">Graded</span> : lab.submission_id ? <span className="badge accent">Submitted</span> : <span className="badge">Not submitted</span>}</td>
                  <td><strong>{lab.grade !== null ? lab.grade : '—'}</strong> <span className="muted">/ {lab.max_points}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function Gradebook({ courseId }) {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api(`/courses/${courseId}/gradebook`).then(setData)
  }, [courseId])

  function exportCsv() {
    const rows = [['Student', ...data.labs.map((lab) => lab.title), 'Earned', 'Percent on graded']]
    data.students.forEach((student) => {
      rows.push([student.name, ...student.cells.map((cell) => (cell ? (cell.grade ?? 'submitted') : '')), student.earned, student.percent_graded ?? ''])
    })
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = 'gradebook.csv'
    link.click()
  }

  if (!data) return <Loading />
  return (
    <div className="card">
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>
          <span className="icon-wrap"><Icon name="award" size={16} /></span>
          <h2>Gradebook</h2>
        </div>
        <button className="btn secondary sm" onClick={exportCsv}><Icon name="download" size={14} />Export CSV</button>
      </div>
      <div className="table-wrap">
        <table className="gradebook">
          <thead>
            <tr>
              <th>Student</th>
              {data.labs.map((lab) => <th key={lab.id} title={lab.title}>{lab.title.split('.')[0]}<div className="muted">/{lab.max_points}</div></th>)}
              <th>Total</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((student) => (
              <tr key={student.id}>
                <td><div className="row"><Avatar name={student.name} size={28} />{student.name}</div></td>
                {student.cells.map((cell, index) => {
                  const lab = data.labs[index]
                  const overdue = !cell && lab.deadline && new Date(lab.deadline) < new Date()
                  return (
                    <td key={lab.id}>
                      <button className="cell" onClick={() => navigate(`/materials/${lab.id}`)}>
                        {cell ? (cell.grade !== null ? <strong>{cell.grade}</strong> : <span className="badge accent">Check</span>) : overdue ? <span className="badge bad">Missing</span> : <span className="muted">—</span>}
                      </button>
                    </td>
                  )
                })}
                <td><strong>{student.earned}</strong> <span className="muted small">{student.percent_graded === null ? '' : `${student.percent_graded}%`}</span></td>
                <td>
                  {student.overdue > 0 ? <span className="badge bad">{student.overdue} overdue</span> : <span className="badge ok">On track</span>}
                  <div className="muted small">{student.last_seen ? `Seen ${timeAgo(student.last_seen)}` : 'Never logged in'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
