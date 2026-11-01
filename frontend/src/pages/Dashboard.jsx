import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmt, relative, timeAgo } from '../api.js'
import { Avatar, colorFor, Empty, Icon, Loading, Modal, ProgressBar, useToast } from '../components/ui.jsx'

function NewCourse({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', grp: 'CS-21' })
  const [error, setError] = useState('')
  const toast = useToast()
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function create(event) {
    event.preventDefault()
    setError('')
    try {
      await api('/courses', { method: 'POST', body: form })
      toast('Course created')
      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Add a course" onClose={onClose}>
      <form onSubmit={create} className="stack">
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={form.title} onChange={set('title')} placeholder="e.g. Computer Networks" autoFocus required />
        </label>
        <label className="field">
          <span className="label">Description</span>
          <textarea className="textarea" style={{ minHeight: 80 }} value={form.description} onChange={set('description')} placeholder="What is this course about?" />
        </label>
        <label className="field">
          <span className="label">Student group</span>
          <input className="input" value={form.grp} onChange={set('grp')} required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Add course</button>
        </div>
      </form>
    </Modal>
  )
}

function TeacherDashboard({ data, user, onChanged }) {
  const [adding, setAdding] = useState(false)
  const groups = {}
  data.courses.forEach((course) => {
    groups[course.grp] = course.students
  })
  const students = Object.values(groups).reduce((sum, count) => sum + count, 0)
  const ungraded = data.courses.reduce((sum, course) => sum + course.ungraded, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi, {user.name.split(' ')[0]}</h1>
          <p>Your courses and the work waiting for you.</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New course</button>
      </div>
      <div className="grid three">
        <div className="card tile"><span className="icon-wrap"><Icon name="book" /></span><div><strong>{data.courses.length}</strong><span className="muted small">Courses</span></div></div>
        <div className="card tile"><span className="icon-wrap"><Icon name="users" /></span><div><strong>{students}</strong><span className="muted small">Students</span></div></div>
        <div className="card tile"><span className="icon-wrap"><Icon name="file" /></span><div><strong>{ungraded}</strong><span className="muted small">Waiting for a grade</span></div></div>
      </div>
      {data.recent.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>To grade</h2></div>
          {data.recent.map((row) => (
            <Link to={`/materials/${row.material_id}`} className="item" key={row.id}>
              <Avatar name={row.student} size={40} />
              <div className="grow">
                <strong>{row.student}</strong>
                <span className="muted small">{row.title} · {row.course_title}</span>
              </div>
              <div className="side">
                <span className="muted small">{timeAgo(row.submitted_at)}</span>
                <Icon name="right" size={18} />
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="section">
        <div className="section-head"><h2>Your courses</h2></div>
        {data.courses.length === 0 && <Empty icon="book">No courses yet. Create the first one.</Empty>}
        <div className="grid two">
          {data.courses.map((course) => (
            <Link to={`/courses/${course.id}`} className="card course-card" key={course.id} style={{ '--stripe': colorFor(course.id) }}>
              <h3>{course.title}</h3>
              <div className="meta">
                <span className="badge">Group {course.grp}</span>
                <span>{course.students} students</span>
              </div>
              <div className="row between">
                {course.ungraded > 0 ? <span className="badge warn">{course.ungraded} to grade</span> : <span className="badge ok">All graded</span>}
                <span className="row small muted">Open <Icon name="right" size={16} /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {adding && <NewCourse onClose={() => setAdding(false)} onCreated={onChanged} />}
    </>
  )
}

export default function Dashboard({ user, onCoursesChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  function load() {
    api('/me/dashboard').then(setData).catch((err) => setError(err.message))
  }

  useEffect(load, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <Loading />

  if (data.role !== 'student') {
    return (
      <TeacherDashboard
        data={data}
        user={user}
        onChanged={() => {
          load()
          onCoursesChanged()
        }}
      />
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi, {user.name.split(' ')[0]}</h1>
          <p>
            {data.deadlines.length === 0 ? 'You have nothing left to submit.' : `You have ${data.deadlines.length} ${data.deadlines.length === 1 ? 'deadline' : 'deadlines'} ahead.`}
          </p>
        </div>
        {data.due_cards > 0 && (
          <Link to="/flashcards" className="btn secondary"><Icon name="cards" size={16} />Review {data.due_cards} cards</Link>
        )}
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-head"><h2>Deadlines</h2><Link to="/calendar" className="link-btn small">Open calendar</Link></div>
        {data.deadlines.length === 0 && <Empty icon="check">All caught up. Nothing to submit right now.</Empty>}
        {data.deadlines.map((item) => {
          const due = relative(item.deadline)
          return (
            <Link to={`/materials/${item.id}`} className="item" key={item.id}>
              <span className={`icon-wrap ${due.tone === 'ok' ? '' : due.tone}`}><Icon name="clock" size={20} /></span>
              <div className="grow">
                <strong>{item.title}</strong>
                <span className="muted small">{item.course_title} · {fmt(item.deadline)} · {item.max_points} points</span>
              </div>
              <div className="side">
                <span className={`badge ${due.tone}`}>{due.text}</span>
                <Icon name="right" size={18} />
              </div>
            </Link>
          )
        })}
      </div>

      {data.announcements.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Announcements</h2></div>
          {data.announcements.map((item) => (
            <Link to={`/courses/${item.course_id}?tab=announcements`} className="item" key={item.id}>
              <span className="icon-wrap accent"><Icon name="megaphone" size={20} /></span>
              <div className="grow">
                <strong>{item.title}</strong>
                <span className="muted small">{item.course_title} · {timeAgo(item.created_at)}</span>
              </div>
              <div className="side">
                {!item.read && <span className="badge accent">New</span>}
                <Icon name="right" size={18} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="section">
        <div className="section-head"><h2>My progress</h2></div>
        <div className="grid two">
          {data.courses.map((course) => {
            const color = colorFor(course.id)
            return (
              <Link to={`/courses/${course.id}`} className="card course-card" key={course.id} style={{ '--stripe': color }}>
                <h3>{course.title}</h3>
                <div className="meta">
                  <Avatar name={course.teacher} size={22} />
                  <span>{course.teacher}</span>
                </div>
                <ProgressBar percent={course.total_max ? (100 * course.earned) / course.total_max : 0} color={color} />
                <dl className="stats" style={{ margin: '14px 0 0' }}>
                  <div className="stat"><dt>Earned</dt><dd>{course.earned}</dd></div>
                  <div className="stat"><dt>On graded work</dt><dd>{course.percent_graded === null ? '—' : `${course.percent_graded}%`}</dd></div>
                  <div className="stat"><dt>Max possible</dt><dd>{course.total_max}</dd></div>
                </dl>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
