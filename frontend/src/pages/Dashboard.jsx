import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmt } from '../api.js'

function NewCourse({ onCreated }) {
  const [title, setTitle] = useState('')
  const [grp, setGrp] = useState('CS-21')
  const [error, setError] = useState('')

  async function create(event) {
    event.preventDefault()
    setError('')
    try {
      await api('/courses', { method: 'POST', body: { title, grp } })
      setTitle('')
      onCreated()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="card" onSubmit={create}>
      <h2>Add a course</h2>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Student group
        <input value={grp} onChange={(e) => setGrp(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Add course</button>
    </form>
  )
}

export default function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  function load() {
    api('/me/dashboard').then(setData).catch((err) => setError(err.message))
  }

  useEffect(load, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p>Loading…</p>

  if (data.role === 'teacher') {
    return (
      <>
        <h1>Hi, {user.name.split(' ')[0]}</h1>
        <h2>Your courses</h2>
        <div className="grid">
          {data.courses.map((course) => (
            <div className="card" key={course.id}>
              <h3>{course.title}</h3>
              <p className="muted">
                Group {course.grp} · {course.students} students
              </p>
              <p>{course.ungraded} submissions waiting for a grade</p>
              <Link className="button" to={`/courses/${course.id}`}>Open course</Link>
            </div>
          ))}
        </div>
        <NewCourse onCreated={load} />
      </>
    )
  }

  return (
    <>
      <h1>Hi, {user.name.split(' ')[0]}</h1>
      <h2>Deadlines</h2>
      {data.deadlines.length === 0 && <p className="muted">Nothing left to submit.</p>}
      <div className="list">
        {data.deadlines.map((item) => (
          <div className="card row between" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <div className="muted">{item.course_title}</div>
            </div>
            <div className="row">
              <span className={item.overdue ? 'tag bad' : 'tag'}>
                {item.overdue ? 'Overdue · ' : ''}
                {fmt(item.deadline)}
              </span>
              <Link className="button" to={`/materials/${item.id}`}>Open</Link>
            </div>
          </div>
        ))}
      </div>
      <h2>My progress</h2>
      <div className="grid">
        {data.courses.map((course) => (
          <div className="card" key={course.id}>
            <h3>{course.title}</h3>
            <p className="muted">{course.teacher}</p>
            <dl className="numbers">
              <div>
                <dt>Earned</dt>
                <dd>{course.earned}</dd>
              </div>
              <div>
                <dt>On graded work</dt>
                <dd>{course.percent_graded === null ? '—' : `${course.percent_graded}%`}</dd>
              </div>
              <div>
                <dt>Max possible</dt>
                <dd>{course.total_max}</dd>
              </div>
            </dl>
            <Link className="button" to={`/courses/${course.id}`}>Open course</Link>
          </div>
        ))}
      </div>
    </>
  )
}
