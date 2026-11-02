import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, download, relative } from '../api.js'
import { colorFor, Empty, Icon, Loading } from '../components/ui.jsx'

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const key = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

export default function Calendar() {
  const [events, setEvents] = useState(null)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selected, setSelected] = useState(new Date())

  useEffect(() => {
    api('/calendar').then(setEvents)
  }, [])

  if (!events) return <Loading />

  const byDay = {}
  events.forEach((event) => {
    const day = key(new Date(event.deadline))
    byDay[day] = [...(byDay[day] || []), event]
  })
  const offset = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))]
  const today = new Date()
  const chosen = byDay[key(selected)] || []
  const upcoming = events.filter((event) => new Date(event.deadline) >= today).slice(0, 5)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Календар</h1>
        </div>
        <button className="btn secondary" onClick={() => download('/calendar.ics', 'deadlines.ics')}><Icon name="download" size={16} />Експорт .ics</button>
      </div>
      <div className="calendar-layout">
        <div className="card">
          <div className="cal-head big">
            <button className="icon-btn" aria-label="Попередній місяць" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="left" /></button>
            <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
            <button className="icon-btn" aria-label="Наступний місяць" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="right" /></button>
          </div>
          <div className="month">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((name) => <span key={name} className="dow">{name}</span>)}
            {cells.map((date, index) => {
              if (!date) return <span key={'blank' + index} />
              const list = byDay[key(date)] || []
              const classes = ['day', key(date) === key(today) ? 'today' : '', key(date) === key(selected) ? 'sel' : ''].join(' ')
              return (
                <button key={index} className={classes} onClick={() => setSelected(date)}>
                  <span>{date.getDate()}</span>
                  <span className="dots">
                    {list.slice(0, 3).map((event) => <i key={event.id} style={{ background: event.overdue ? 'var(--bad)' : colorFor(event.course_id) }} />)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-title"><h2>{selected.toLocaleDateString('uk-UA', { dateStyle: 'full' })}</h2></div>
            {chosen.length === 0 && <p className="muted small">У цей день дедлайнів немає.</p>}
            {chosen.map((event) => {
              const due = relative(event.deadline)
              return (
                <Link to={`/materials/${event.id}`} className="item" key={event.id}>
                  <span className="icon-wrap" style={{ background: colorFor(event.course_id) + '22', color: colorFor(event.course_id) }}><Icon name="clock" size={18} /></span>
                  <div className="grow">
                    <strong>{event.title}</strong>
                    <span className="muted small">{event.course_title} · {new Date(event.deadline).toLocaleTimeString('uk-UA', { timeStyle: 'short' })}</span>
                  </div>
                  <div className="side">
                    {event.grade !== null && event.grade !== undefined ? <span className="badge ok">{event.grade} / {event.max_points}</span> : event.submission_id ? <span className="badge accent">Здано</span> : <span className={`badge ${due.tone}`}>{due.text}</span>}
                  </div>
                </Link>
              )
            })}
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
