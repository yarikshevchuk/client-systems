import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmt, plural, timeAgo } from '../api.js'
import { Avatar, Icon, Loading, ProgressBar, Stepper } from './ui.jsx'

function Simulator({ data }) {
  const [target, setTarget] = useState(75)
  const remaining = data.total_max - data.graded_max
  const needed = Math.ceil((target / 100) * data.total_max) - data.earned
  const best = data.total_max ? Math.round((100 * (data.earned + remaining)) / data.total_max) : 0
  let text
  let tone = 'ok'
  if (needed <= 0) {
    text = `Ви вже набрали ${target}% балів курсу.`
  } else if (needed > remaining) {
    text = `${target}% недосяжні. Максимум, який ви можете отримати, — ${best}%.`
    tone = 'bad'
  } else {
    text = `Вам потрібно ще ${needed} ${plural(needed, 'бал', 'бали', 'балів')} із ${remaining} можливих, це близько ${Math.round((100 * needed) / remaining)}% решти лабораторних.`
    tone = needed / remaining > 0.8 ? 'warn' : 'ok'
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="award" size={16} /></span>
        <h2>Що мені потрібно, щоб отримати…</h2>
      </div>
      <div className="row wrap">
        <span>Я хочу завершити курс з</span>
        <Stepper value={target} onChange={(value) => setTarget(value === '' ? 0 : value)} min={0} max={100} />
        <span>% усіх балів курсу</span>
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
          <h2>Прогноз оцінки</h2>
        </div>
        <ProgressBar percent={data.total_max ? (100 * data.earned) / data.total_max : 0} color={color} />
        <dl className="stats" style={{ margin: '14px 0 0' }}>
          <div className="stat"><dt>Зароблено</dt><dd>{data.earned}</dd></div>
          <div className="stat"><dt>За оціненими</dt><dd>{data.percent_graded === null ? '—' : `${data.percent_graded}%`}</dd></div>
          <div className="stat"><dt>Максимум</dt><dd>{data.total_max}</dd></div>
        </dl>
      </div>
      <Simulator data={data} />
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Лабораторна</th><th>Дедлайн</th><th>Статус</th><th>Оцінка</th></tr>
            </thead>
            <tbody>
              {data.labs.map((lab) => (
                <tr key={lab.id}>
                  <td>
                    <Link className="link-btn" to={`/materials/${lab.id}`}>{lab.title}</Link>
                    {lab.feedback && <div className="muted small">“{lab.feedback}”</div>}
                  </td>
                  <td className="muted">{fmt(lab.deadline)}</td>
                  <td>{lab.grade !== null ? <span className="badge ok">Оцінено</span> : lab.submission_id ? <span className="badge accent">Здано</span> : <span className="badge">Не здано</span>}</td>
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
    const rows = [['Студент', ...data.labs.map((lab) => lab.title), 'Зароблено', 'Відсоток за оціненими']]
    data.students.forEach((student) => {
      rows.push([student.name, ...student.cells.map((cell) => (cell ? (cell.grade ?? 'здано') : '')), student.earned, student.percent_graded ?? ''])
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
          <h2>Журнал оцінок</h2>
        </div>
        <button className="btn secondary sm" onClick={exportCsv}><Icon name="download" size={14} />Експорт CSV</button>
      </div>
      <div className="table-wrap">
        <table className="gradebook">
          <thead>
            <tr>
              <th>Студент</th>
              {data.labs.map((lab) => <th key={lab.id} title={lab.title}>{lab.title.split('.')[0]}<div className="muted">/{lab.max_points}</div></th>)}
              <th>Разом</th>
              <th>Активність</th>
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
                        {cell ? (cell.grade !== null ? <strong>{cell.grade}</strong> : <span className="badge accent">Перевірити</span>) : overdue ? <span className="badge bad">Немає</span> : <span className="muted">—</span>}
                      </button>
                    </td>
                  )
                })}
                <td><strong>{student.earned}</strong> <span className="muted small">{student.percent_graded === null ? '' : `${student.percent_graded}%`}</span></td>
                <td>
                  {student.overdue > 0 ? <span className="badge bad">{student.overdue} прострочено</span> : <span className="badge ok">Усе гаразд</span>}
                  <div className="muted small">{student.last_seen ? `В мережі ${timeAgo(student.last_seen)}` : 'Ще не входив(ла)'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
