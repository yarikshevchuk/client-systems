import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmt, plural, relative, timeAgo } from '../api.js'
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
        <div>
          <h1>Вітаємо, {user.name.split(' ')[0]}</h1>
          <p>{ungraded === 0 ? 'Нових робіт на перевірку немає.' : `На перевірку: ${ungraded} ${plural(ungraded, 'робота', 'роботи', 'робіт')}.`}</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Новий курс</button>
      </div>
      <div className="dash-layout">
        <div>
          <h2 style={{ marginBottom: 6 }}>Очікують перевірки</h2>
          {data.recent.length === 0 && <Empty icon="check">Усе перевірено.</Empty>}
          {data.recent.map((row) => (
            <Link to={`/materials/${row.material_id}`} className="todo-row" key={row.id}>
              <Avatar name={row.student} size={32} />
              <div className="grow">
                <span className="todo-title">{row.student}</span>
                <div className="muted small">{row.title} · {row.course_title}</div>
              </div>
              <span className="muted small">{timeAgo(row.submitted_at)}</span>
              <span className="btn sm">Оцінити</span>
            </Link>
          ))}
        </div>
        <aside className="side-list">
          <h2>Мої курси</h2>
          {data.courses.length === 0 && <p className="muted">Курсів ще немає.</p>}
          {data.courses.map((course) => (
            <Link to={`/courses/${course.id}`} className="side-row" key={course.id}>
              <strong>{course.title}</strong>
              <span className="muted small">Група {course.grp} · {course.students} {plural(course.students, 'студент', 'студенти', 'студентів')}{course.ungraded > 0 ? ` · на перевірку: ${course.ungraded}` : ''}</span>
            </Link>
          ))}
        </aside>
      </div>
      {adding && <NewCourse onClose={() => setAdding(false)} onCreated={onChanged} />}
    </>
  )
}

function groupDeadlines(list) {
  const week = new Date(Date.now() + 7 * 86400000)
  return [
    ['Прострочено', list.filter((d) => d.overdue), 'bad'],
    ['Цього тижня', list.filter((d) => !d.overdue && new Date(d.deadline) <= week), 'warn'],
    ['Пізніше', list.filter((d) => !d.overdue && new Date(d.deadline) > week), ''],
  ].filter((group) => group[1].length > 0)
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

  const groups = groupDeadlines(data.deadlines)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Вітаємо, {user.name.split(' ')[0]}</h1>
          <p>{data.deadlines.length === 0 ? 'Усе здано, справ немає.' : `Чекає здачі: ${data.deadlines.length} ${plural(data.deadlines.length, 'робота', 'роботи', 'робіт')}.`}</p>
        </div>
        {data.due_cards > 0 && <Link to="/flashcards" className="btn secondary"><Icon name="cards" size={16} />Повторити {data.due_cards} {plural(data.due_cards, 'картку', 'картки', 'карток')}</Link>}
      </div>
      <div className="dash-layout">
        <div>
          <h2 style={{ marginBottom: 10 }}>Що потрібно зробити</h2>
          {groups.length === 0 && <Empty icon="check">Усе здано. Зараз нічого робити.</Empty>}
          {groups.map(([title, rows, tone]) => (
            <section className="todo-group" key={title}>
              <h3 className={`group-title ${tone}`}>{title} <span>· {rows.length}</span></h3>
              {rows.map((row) => {
                const due = relative(row.deadline)
                return (
                  <div className="todo-row" key={row.id}>
                    <div className="grow">
                      <Link to={`/materials/${row.id}`} className="todo-title">{row.title}</Link>
                      <div className="muted small">{row.course_title} · до {fmt(row.deadline)} · {row.max_points} балів</div>
                    </div>
                    <span className={`status-text ${due.tone === 'ok' ? '' : due.tone}`}>{due.text}</span>
                    <Link to={`/materials/${row.id}`} className="btn sm">Здати</Link>
                  </div>
                )
              })}
            </section>
          ))}
          {data.announcements.length > 0 && (
            <section className="todo-group" style={{ marginTop: 28 }}>
              <h3 className="group-title">Оголошення</h3>
              {data.announcements.map((item) => (
                <Link to={`/courses/${item.course_id}?tab=announcements`} className="todo-row" key={item.id}>
                  <div className="grow">
                    <span className="todo-title">{item.title}</span>
                    <div className="muted small">{item.course_title} · {timeAgo(item.created_at)}</div>
                  </div>
                  {!item.read && <span className="status-text accent">Нове</span>}
                </Link>
              ))}
            </section>
          )}
        </div>
        <aside className="side-list">
          <h2>Мої курси</h2>
          {data.courses.map((course) => (
            <Link to={`/courses/${course.id}`} className="side-row" key={course.id}>
              <strong>{course.title}</strong>
              <span className="muted small">{course.teacher}</span>
              <div style={{ margin: '6px 0 2px' }}><ProgressBar percent={course.total_max ? (100 * course.earned) / course.total_max : 0} color={colorFor(course.id)} /></div>
              <span className="muted small">{course.earned} із {course.total_max} балів{course.percent_graded === null ? '' : ` · ${course.percent_graded}% за оціненими`}</span>
            </Link>
          ))}
        </aside>
      </div>
    </>
  )
}
