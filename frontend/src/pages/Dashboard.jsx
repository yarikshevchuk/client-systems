import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtShort, plural, relative, timeAgo } from '../api.js'
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
      toast('Курс створено')
      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Додати курс" onClose={onClose}>
      <form onSubmit={create} className="stack">
        <label className="field">
          <span className="label">Назва</span>
          <input className="input" value={form.title} onChange={set('title')} placeholder="наприклад, Комп'ютерні мережі" autoFocus required />
        </label>
        <label className="field">
          <span className="label">Опис</span>
          <textarea className="textarea" style={{ minHeight: 80 }} value={form.description} onChange={set('description')} placeholder="Про що цей курс?" />
        </label>
        <label className="field">
          <span className="label">Група студентів</span>
          <input className="input" value={form.grp} onChange={set('grp')} required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn">Додати курс</button>
        </div>
      </form>
    </Modal>
  )
}

function TeacherDashboard({ data, user, onChanged }) {
  const [adding, setAdding] = useState(false)
  const ungraded = data.courses.reduce((sum, course) => sum + course.ungraded, 0)

  return (
    <>
      <div className="page-head">
        <h1>Привіт, {user.name.split(' ')[0]}</h1>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Новий курс</button>
      </div>
      <div className="dash-layout">
        <div>
          <h3 className="group-title">На перевірку {ungraded > 0 ? `· ${ungraded}` : ''}</h3>
          {data.recent.length === 0 && <Empty icon="check">Усе перевірено.</Empty>}
          {data.recent.map((row) => (
            <Link to={`/materials/${row.material_id}`} className="next-row" key={row.id}>
              <Avatar name={row.student} size={30} />
              <span className="grow">
                <b>{row.student}</b>
                <span className="muted small">{row.title}</span>
              </span>
              <span className="muted small">{timeAgo(row.submitted_at)}</span>
              <span className="btn sm">Оцінити</span>
            </Link>
          ))}
        </div>
        <aside className="side-list">
          <h3 className="group-title">Мої курси</h3>
          {data.courses.map((course) => (
            <Link to={`/courses/${course.id}`} className="course-line" key={course.id}>
              <i className="dot" style={{ background: colorFor(course.id) }} />
              <span className="grow">{course.title}</span>
              {course.ungraded > 0 && <span className="status-text warn">{course.ungraded}</span>}
            </Link>
          ))}
        </aside>
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

  const [next, ...others] = data.deadlines
  const news = data.announcements.filter((item) => !item.read).slice(0, 2)
  const nextDue = next && relative(next.deadline)

  return (
    <>
      <div className="page-head">
        <h1>Привіт, {user.name.split(' ')[0]}</h1>
        {data.due_cards > 0 && <Link to="/flashcards" className="btn secondary sm"><Icon name="cards" size={14} />Картки: {data.due_cards}</Link>}
      </div>
      {news.map((item) => (
        <Link key={item.id} to={`/courses/${item.course_id}?tab=announcements`} className="notice">
          <Icon name="megaphone" size={16} />
          <span><b>{item.title}</b> · {item.course_title}</span>
        </Link>
      ))}
      <div className="dash-layout">
        <div>
          {!next && <Empty icon="check">Усе здано. Можна відпочити.</Empty>}
          {next && (
            <div className={`hero ${nextDue.tone}`}>
              <div className="hero-label">{next.overdue ? 'Прострочено' : 'Найближче'} · {nextDue.text}</div>
              <h2 className="hero-title">{next.title}</h2>
              <div className="hero-meta"><i className="dot" style={{ background: colorFor(next.course_id) }} />{next.course_title} · до {fmtShort(next.deadline)}</div>
              <Link to={`/materials/${next.id}`} className="btn lg">Здати роботу</Link>
            </div>
          )}
          {others.length > 0 && <h3 className="group-title" style={{ marginTop: 26 }}>Далі</h3>}
          {others.map((row) => {
            const due = relative(row.deadline)
            return (
              <Link to={`/materials/${row.id}`} className="next-row" key={row.id}>
                <i className="dot" style={{ background: colorFor(row.course_id) }} />
                <span className="grow">
                  <b>{row.title}</b>
                  <span className="muted small">{row.course_title}</span>
                </span>
                <span className={`status-text ${due.tone === 'ok' ? '' : due.tone}`}>{fmtShort(row.deadline)}</span>
              </Link>
            )
          })}
        </div>
        <aside className="side-list">
          <h3 className="group-title">Мої курси</h3>
          {data.courses.map((course) => (
            <Link to={`/courses/${course.id}`} className="course-line" key={course.id}>
              <i className="dot" style={{ background: colorFor(course.id) }} />
              <span className="grow">{course.title}</span>
              <b>{course.earned}<span className="muted small"> / {course.total_max}</span></b>
            </Link>
          ))}
        </aside>
      </div>
    </>
  )
}
