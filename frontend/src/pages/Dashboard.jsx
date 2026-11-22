import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, deadlineStatus, fmtShort, timeAgo } from '../api.js'
import { Avatar, colorFor, Empty, Icon, Loading, Modal, ProgressBar } from '../components/ui.jsx'
import { t } from '../i18n.js'

function NewCourse({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', grp: 'CS-21' })
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function create(event) {
    event.preventDefault()
    try {
      await api('/courses', { method: 'POST', body: form })
      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={t("Додати курс")} onClose={onClose}>
      <form onSubmit={create} className="stack">
        <label className="field">
          <span className="label">{t("Назва")}</span>
          <input className="input" value={form.title} onChange={set('title')} placeholder={t("наприклад, Комп'ютерні мережі")} autoFocus required />
        </label>
        <label className="field">
          <span className="label">{t("Опис")}</span>
          <textarea className="textarea" value={form.description} onChange={set('description')} placeholder={t("Про що цей курс?")} />
        </label>
        <label className="field">
          <span className="label">{t("Група студентів")}</span>
          <input className="input" value={form.grp} onChange={set('grp')} required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{t("Додати курс")}</button>
        </div>
      </form>
    </Modal>
  )
}

function CourseTile({ course, student, next }) {
  const color = colorFor(course.id)
  const status = next && deadlineStatus(next.deadline)
  return (
    <Link to={`/courses/${course.id}`} className="course-tile">
      <div className="tile-band" style={{ background: color }}>
        <h3>{course.title}</h3>
        <span>{course.teacher}</span>
      </div>
      <div className="tile-body">
        {student ? (
          <>
            <div className="row between small"><span className="muted">{t("Бали за курс")}</span><b>{course.earned} / {course.total_max}</b></div>
            <ProgressBar percent={course.total_max ? (100 * course.earned) / course.total_max : 0} color={color} />
            <div className="tile-next small">
              {next
                ? <><span className="muted">{t("Найближче:")}</span> {next.title.split('.')[0]} · <span className={`status-text ${status.tone}`}>{status.text}</span></>
                : <span className="muted">{t("Немає невиконаних завдань")}</span>}
            </div>
          </>
        ) : (
          <div className="row between small">
            <span className="muted">{t("Група")} {course.grp}</span>
            {course.ungraded > 0 ? <span className="badge warn">{t("На перевірку:")} {course.ungraded}</span> : <span className="badge ok">{t("Усе перевірено")}</span>}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function Dashboard({ user, onCoursesChanged }) {
  const [data, setData] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = () => api('/me/dashboard').then(setData)
  useEffect(() => { load() }, [])

  if (!data) return <Loading />
  const student = data.role === 'student'
  const firstName = user.name.split(' ')[0]

  if (!student) {
    return (
      <>
        <div className="page-head">
          <h1>{t("Привіт,")} {firstName}</h1>
          <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{t("Новий курс")}</button>
        </div>
        <h3 className="group-title">{t("Мої курси")}</h3>
        <div className="tile-grid">
          {data.courses.map((course) => <CourseTile key={course.id} course={course} />)}
        </div>
        <h3 className="group-title">{t("На перевірку")}</h3>
        {data.recent.length === 0 && <Empty icon="check">{t("Усе перевірено.")}</Empty>}
        {data.recent.map((row) => (
          <Link to={`/materials/${row.material_id}`} className="next-row" key={row.id}>
            <Avatar name={row.student} size={30} />
            <span className="grow"><b>{row.student}</b><span className="muted small">{row.title}</span></span>
            <span className="muted small">{timeAgo(row.submitted_at)}</span>
            <span className="btn sm">{t("Оцінити")}</span>
          </Link>
        ))}
        {adding && <NewCourse onClose={() => setAdding(false)} onCreated={() => { load(); onCoursesChanged() }} />}
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>{t("Привіт,")} {firstName}</h1>
        {data.due_cards > 0 && <Link to="/flashcards" className="btn secondary sm"><Icon name="cards" size={14} />{t("Картки:")} {data.due_cards}</Link>}
      </div>
      {data.announcements.filter((item) => !item.read).slice(0, 2).map((item) => (
        <Link key={item.id} to={`/courses/${item.course_id}?tab=announcements`} className="notice">
          <Icon name="megaphone" size={16} />
          <span><b>{item.title}</b> · {item.course_title}</span>
        </Link>
      ))}
      <h3 className="group-title">{t("Мої курси")}</h3>
      <div className="tile-grid">
        {data.courses.map((course) => (
          <CourseTile key={course.id} course={course} student next={data.deadlines.find((row) => row.course_id === course.id)} />
        ))}
      </div>
      <h3 className="group-title" style={{ marginTop: 28 }}>{t("Завдання, які треба здати")}</h3>
      {data.deadlines.length === 0 && <Empty icon="check">{t("Усе здано. Можна відпочити.")}</Empty>}
      {data.deadlines.map((row) => (
        <Link to={`/materials/${row.id}`} className="next-row" key={row.id}>
          <i className="dot" style={{ background: colorFor(row.course_id) }} />
          <span className="grow"><b>{row.title}</b><span className="muted small">{row.course_title}</span></span>
          <span className={`status-text ${deadlineStatus(row.deadline).tone}`}>{fmtShort(row.deadline)}</span>
        </Link>
      ))}
    </>
  )
}
