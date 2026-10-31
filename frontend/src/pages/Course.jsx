import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmt, relative } from '../api.js'
import Chat from '../components/Chat.jsx'
import { Avatar, colorFor, Empty, Icon, ProgressBar, Tabs } from '../components/ui.jsx'

function Grades({ courseId, color }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api(`/courses/${courseId}/grades`).then(setData)
  }, [courseId])

  if (!data) return <p className="muted">Loading…</p>
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
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Lab</th><th>Deadline</th><th>Status</th><th>Grade</th></tr>
            </thead>
            <tbody>
              {data.labs.map((lab) => (
                <tr key={lab.id}>
                  <td><Link className="link-btn" to={`/materials/${lab.id}`}>{lab.title}</Link></td>
                  <td className="muted">{fmt(lab.deadline)}</td>
                  <td>
                    {lab.grade !== null ? <span className="badge ok">Graded</span> : lab.submission_id ? <span className="badge accent">Submitted</span> : <span className="badge">Not submitted</span>}
                  </td>
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

export default function Course({ user }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('topics')
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setTab('topics')
    api(`/courses/${id}`).then(setData).catch((err) => setError(err.message))
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Loading…</p>

  const color = colorFor(data.course.id)
  const tabs = [
    { value: 'topics', label: 'Topics', icon: 'layers' },
    { value: 'qa', label: 'Q&A', icon: 'chat' },
    ...(user.role === 'student' ? [{ value: 'grades', label: 'Grades', icon: 'award' }] : []),
  ]

  return (
    <>
      <Link to="/" className="crumb"><Icon name="left" size={16} />Dashboard</Link>
      <div className="page-head">
        <div>
          <h1>{data.course.title}</h1>
          <p className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            <Avatar name={data.course.teacher} size={22} />
            <span>{data.course.teacher}</span>
            <span className="badge">Group {data.course.grp}</span>
          </p>
        </div>
        {user.role === 'teacher' && (
          <Link className="btn secondary" to={`/courses/${id}/settings`}><Icon name="sliders" size={16} />Course settings</Link>
        )}
      </div>
      <Tabs value={tab} onChange={setTab} options={tabs} />

      {tab === 'topics' && (
        <>
          {data.topics.length === 0 && <Empty icon="layers">No topics yet.{user.role === 'teacher' ? ' Add the first one in course settings.' : ''}</Empty>}
          {data.topics.map((topic, index) => (
            <section className="topic" key={topic.id} style={index === 0 ? { marginTop: 0 } : undefined}>
              <div className="topic-title">
                <span className="num" style={{ background: color }}>{index + 1}</span>
                <h2>{topic.title.replace(/^Topic \d+\.\s*/, '')}</h2>
              </div>
              {topic.materials.length === 0 && <p className="muted small">No materials yet.</p>}
              {topic.materials.map((material) => {
                const due = material.kind === 'lab' ? relative(material.deadline) : null
                return (
                  <Link to={`/materials/${material.id}`} className="item" key={material.id}>
                    <span className={material.kind === 'lab' ? 'icon-wrap accent' : 'icon-wrap'}>
                      <Icon name={material.kind === 'lab' ? 'file' : 'book'} size={20} />
                    </span>
                    <div className="grow">
                      <strong>{material.title}</strong>
                      <span className="muted small">
                        {material.kind === 'lab' ? `Lab · due ${fmt(material.deadline)} · ${material.max_points} points` : 'Lecture'}
                      </span>
                    </div>
                    <div className="side">
                      {due && <span className={`badge ${due.tone}`}>{due.text}</span>}
                      <Icon name="right" size={18} />
                    </div>
                  </Link>
                )
              })}
            </section>
          ))}
        </>
      )}
      {tab === 'qa' && <Chat courseId={id} />}
      {tab === 'grades' && <Grades courseId={id} color={color} />}
    </>
  )
}
