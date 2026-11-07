import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, deadlineStatus, download } from '../api.js'
import { colorFor, Empty, Icon, Loading } from '../components/ui.jsx'

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const sameDay = (a, b) => a.toDateString() === b.toDateString()

function EventBadge({ event }) {
  if (event.grade != null) return <span className="badge ok">{event.grade} / {event.max_points}</span>
  if (event.submission_id) return <span className="badge accent">Здано</span>
  const status = deadlineStatus(event.deadline)
  return <span className={`badge ${status.tone || 'ok'}`}>{status.text}</span>
}

export default function Calendar() {
  const [events, setEvents] = useState(null)
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selected, setSelected] = useState(new Date())

  useEffect(() => {
    api('/calendar').then(setEvents)
  }, [])

  if (!events) return <Loading />

  const year = month.getFullYear()
  const firstWeekday = (month.getDay() + 6) % 7
  const daysInMonth = new Date(year, month.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month.getMonth(), i + 1))
  const eventsOn = (day) => events.filter((event) => sameDay(new Date(event.deadline), day))
  const upcoming = events.filter((event) => new Date(event.deadline) >= new Date()).slice(0, 5)

  return (
    <>
      <div className="page-head">
        <h1>Календар</h1>
        <button className="btn secondary" onClick={() => download('/calendar.ics', 'deadlines.ics')}><Icon name="download" size={16} />Експорт .ics</button>
      </div>
      <div className="calendar-layout">
        <div className="card">
          <div className="cal-head big">
            <button className="icon-btn" title="Попередній місяць" onClick={() => setMonth(new Date(year, month.getMonth() - 1, 1))}><Icon name="left" /></button>
            <strong>{MONTHS[month.getMonth()]} {year}</strong>
            <button className="icon-btn" title="Наступний місяць" onClick={() => setMonth(new Date(year, month.getMonth() + 1, 1))}><Icon name="right" /></button>
          </div>
          <div className="month">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((name) => <span key={name} className="dow">{name}</span>)}
            {Array.from({ length: firstWeekday }, (_, i) => <span key={'empty' + i} />)}
            {days.map((day) => (
              <button key={day.getDate()} className={`day ${sameDay(day, new Date()) ? 'today' : ''} ${sameDay(day, selected) ? 'sel' : ''}`} onClick={() => setSelected(day)}>
                <span>{day.getDate()}</span>
                <span className="dots">
                  {eventsOn(day).slice(0, 3).map((event) => <i key={event.id} style={{ background: event.overdue ? 'var(--bad)' : colorFor(event.course_id) }} />)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title"><h2>{selected.toLocaleDateString('uk-UA', { dateStyle: 'full' })}</h2></div>
            {eventsOn(selected).length === 0 && <p className="muted small">У цей день дедлайнів немає.</p>}
            {eventsOn(selected).map((event) => (
              <Link to={`/materials/${event.id}`} className="item" key={event.id}>
                <span className="icon-wrap" style={{ background: colorFor(event.course_id) + '22', color: colorFor(event.course_id) }}><Icon name="clock" size={18} /></span>
                <div className="grow">
                  <strong>{event.title}</strong>
                  <span className="muted small">{event.course_title} · {new Date(event.deadline).toLocaleTimeString('uk-UA', { timeStyle: 'short' })}</span>
                </div>
                <div className="side"><EventBadge event={event} /></div>
              </Link>
            ))}
          </div>
          <div className="card">
            <div className="card-title"><h2>Найближче</h2></div>
            {upcoming.length === 0 && <Empty icon="calendar">Найближчих дедлайнів немає.</Empty>}
            {upcoming.map((event) => (
              <Link to={`/materials/${event.id}`} className="upcoming" key={event.id}>
                <span className="dot" style={{ background: colorFor(event.course_id) }} />
                <span className="grow">{event.title}</span>
                <span className="muted small">{new Date(event.deadline).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
