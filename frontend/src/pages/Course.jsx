import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmt } from '../api.js'
import Chat from '../components/Chat.jsx'

function Grades({ courseId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api(`/courses/${courseId}/grades`).then(setData)
  }, [courseId])

  if (!data) return <p>Loading…</p>
  return (
    <div className="card">
      <h2>Grades</h2>
      <dl className="numbers">
        <div>
          <dt>Earned</dt>
          <dd>{data.earned}</dd>
        </div>
        <div>
          <dt>On graded work</dt>
          <dd>{data.percent_graded === null ? '—' : `${data.percent_graded}%`}</dd>
        </div>
        <div>
          <dt>Max possible</dt>
          <dd>{data.total_max}</dd>
        </div>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Lab</th>
            <th>Deadline</th>
            <th>Status</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          {data.labs.map((lab) => (
            <tr key={lab.id}>
              <td>
                <Link to={`/materials/${lab.id}`}>{lab.title}</Link>
              </td>
              <td>{fmt(lab.deadline)}</td>
              <td>{lab.grade !== null ? 'Graded' : lab.submission_id ? 'Submitted' : 'Not submitted'}</td>
              <td>{lab.grade !== null ? `${lab.grade} / ${lab.max_points}` : `— / ${lab.max_points}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Course({ user }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('topics')
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api(`/courses/${id}`).then(setData).catch((err) => setError(err.message))
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p>Loading…</p>

  return (
    <>
      <p>
        <Link to="/">← Dashboard</Link>
      </p>
      <div className="row between wrap">
        <div>
          <h1>{data.course.title}</h1>
          <p className="muted">
            {data.course.teacher} · group {data.course.grp}
          </p>
        </div>
        {user.role === 'teacher' && (
          <Link className="button secondary" to={`/courses/${id}/settings`}>
            Course settings
          </Link>
        )}
      </div>
      <nav className="tabs">
        <button className={tab === 'topics' ? 'active' : ''} onClick={() => setTab('topics')}>Topics</button>
        <button className={tab === 'qa' ? 'active' : ''} onClick={() => setTab('qa')}>Q&amp;A</button>
        {user.role === 'student' && (
          <button className={tab === 'grades' ? 'active' : ''} onClick={() => setTab('grades')}>Grades</button>
        )}
      </nav>
      {tab === 'topics' &&
        data.topics.map((topic) => (
          <div className="card" key={topic.id}>
            <h2>{topic.title}</h2>
            {topic.materials.length === 0 && <p className="muted">No materials yet.</p>}
            <ul className="plain">
              {topic.materials.map((material) => (
                <li key={material.id} className="row between">
                  <Link to={`/materials/${material.id}`}>{material.title}</Link>
                  <span className="muted">
                    {material.kind === 'lab' ? `Due ${fmt(material.deadline)} · ${material.max_points} points` : 'Lecture'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      {tab === 'qa' && <Chat courseId={id} />}
      {tab === 'grades' && <Grades courseId={id} />}
    </>
  )
}
