import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmt, plural, saveCsv, timeAgo } from '../api.js'
import { Avatar, Icon, Loading, ProgressBar } from './ui.jsx'

const isPast = (date) => date && new Date(date) < new Date()

function useGradebook(courseId) {
  const [data, setData] = useState(null)
  useEffect(() => {
    api(`/courses/${courseId}/gradebook`).then(setData)
  }, [courseId])
  return data
}

function Simulator({ data }) {
  const [target, setTarget] = useState(75)
  const remaining = data.total_max - data.graded_max
  const needed = Math.ceil((target / 100) * data.total_max) - data.earned
  const best = Math.round((100 * (data.earned + remaining)) / data.total_max)

  let text = `Вам потрібно ще ${needed} ${plural(needed, 'бал', 'бали', 'балів')} із ${remaining} можливих, це близько ${Math.round((100 * needed) / remaining)}% решти лабораторних.`
  let tone = needed / remaining > 0.8 ? 'warn' : 'ok'
  if (needed <= 0) [text, tone] = [`Ви вже набрали ${target}% балів курсу.`, 'ok']
  else if (needed > remaining) [text, tone] = [`${target}% недосяжні. Максимум, який ви можете отримати, — ${best}%.`, 'bad']

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="award" size={16} /></span>
        <h2>Що мені потрібно, щоб отримати…</h2>
      </div>
      <div className="row wrap">
        <span>Я хочу завершити курс з</span>
        <input className="input" style={{ width: 90 }} type="number" min="0" max="100" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
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
        <ProgressBar percent={(100 * data.earned) / data.total_max} color={color} />
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
            <thead><tr><th>Лабораторна</th><th>Дедлайн</th><th>Статус</th><th>Оцінка</th></tr></thead>
            <tbody>
              {data.labs.map((lab) => (
                <tr key={lab.id}>
                  <td>
                    <Link className="link-btn" to={`/materials/${lab.id}`}>{lab.title}</Link>
                    {lab.feedback && <div className="muted small">“{lab.feedback}”</div>}
                  </td>
                  <td className="muted">{fmt(lab.deadline)}</td>
                  <td>{lab.grade !== null ? <span className="badge ok">Оцінено</span> : lab.submission_id ? <span className="badge accent">Здано</span> : <span className="badge">Не здано</span>}</td>
                  <td><strong>{lab.grade ?? '—'}</strong> <span className="muted">/ {lab.max_points}</span></td>
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
  const data = useGradebook(courseId)
  if (!data) return <Loading />

  function exportCsv() {
    const rows = [['Студент', ...data.labs.map((lab) => lab.title), 'Зароблено', 'Відсоток за оціненими', 'Стан']]
    for (const student of data.students) {
      const cells = student.cells.map((cell) => (cell ? cell.grade ?? 'здано' : ''))
      rows.push([student.name, ...cells, student.earned, student.percent_graded, student.at_risk ? 'Відстає: ' + student.risk_reasons.join('; ') : 'Усе гаразд'])
    }
    saveCsv(rows, 'gradebook.csv')
  }

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
                  let value = <span className="muted">—</span>
                  if (cell) value = cell.grade !== null ? <strong>{cell.grade}</strong> : <span className="badge accent">Перевірити</span>
                  else if (isPast(lab.deadline)) value = <span className="badge bad">Немає</span>
                  return <td key={lab.id}><Link className="cell" to={`/materials/${lab.id}`}>{value}</Link></td>
                })}
                <td><strong>{student.earned}</strong> <span className="muted small">{student.percent_graded !== null && `${student.percent_graded}%`}</span></td>
                <td>
                  {student.at_risk ? <span className="badge bad" title={student.risk_reasons.join('; ')}>Відстає</span> : <span className="badge ok">Усе гаразд</span>}
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

export function Analytics({ courseId }) {
  const data = useGradebook(courseId)
  if (!data) return <Loading />

  const students = data.students
  const atRisk = students.filter((student) => student.at_risk)
  const graded = students.filter((student) => student.percent_graded !== null)
  const average = graded.length ? Math.round(graded.reduce((sum, s) => sum + s.percent_graded, 0) / graded.length) : null
  const pastLabs = data.labs.map((lab) => isPast(lab.deadline))
  const expected = students.length * pastLabs.filter(Boolean).length
  const submitted = students.reduce((sum, s) => sum + s.cells.filter((cell, i) => cell && pastLabs[i]).length, 0)
  const rate = expected ? Math.round((100 * submitted) / expected) : null

  function exportReport() {
    const rows = [['Лабораторна', 'Здали', 'Вчасно', 'Оцінено', 'Середня оцінка', 'Максимум']]
    for (const lab of data.labs) rows.push([lab.title, `${lab.submitted}/${students.length}`, lab.on_time, lab.graded, lab.average, lab.max_points])
    rows.push([], ['Студенти, що відстають', 'Причина'])
    for (const s of atRisk) rows.push([s.name, s.risk_reasons.join('; ')])
    saveCsv(rows, 'zvit-kursu.csv')
  }

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2>Аналітика групи</h2>
        <button className="btn secondary sm" onClick={exportReport}><Icon name="download" size={14} />Звіт CSV</button>
      </div>
      <div className="stat-row">
        <div className="stat-box"><span>Студентів</span><b>{students.length}</b></div>
        <div className="stat-box"><span>Середній результат</span><b>{average === null ? '—' : `${average} %`}</b></div>
        <div className="stat-box"><span>Здано з минулих дедлайнів</span><b>{rate === null ? '—' : `${rate} %`}</b></div>
        <div className={atRisk.length ? 'stat-box bad' : 'stat-box'}><span>Відстають</span><b>{atRisk.length}</b></div>
      </div>
      <div className="card">
        <div className="card-title"><span className="icon-wrap"><Icon name="alert" size={16} /></span><h2>Хто відстає</h2></div>
        {atRisk.length === 0 && <p className="muted">Усі студенти встигають.</p>}
        {atRisk.map((student) => (
          <div className="member-row" key={student.id}>
            <Avatar name={student.name} size={30} />
            <div className="grow"><b>{student.name}</b><div className="muted small">{student.risk_reasons.join(' · ')}</div></div>
            <Link className="btn secondary sm" to={`/messages/${student.id}`}><Icon name="chat" size={14} />Написати</Link>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title"><span className="icon-wrap"><Icon name="chart" size={16} /></span><h2>Лабораторні</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Робота</th><th>Здали</th><th>Вчасно</th><th>Середня оцінка</th></tr></thead>
            <tbody>
              {data.labs.map((lab) => (
                <tr key={lab.id}>
                  <td><Link to={`/materials/${lab.id}`}>{lab.title}</Link></td>
                  <td style={{ minWidth: 160 }}>
                    <div className="row">
                      <span style={{ minWidth: 42 }}>{lab.submitted}/{students.length}</span>
                      <div style={{ flex: 1 }}><ProgressBar percent={(100 * lab.submitted) / students.length} color="var(--accent)" /></div>
                    </div>
                  </td>
                  <td>{lab.on_time}</td>
                  <td>{lab.average === null ? '—' : `${lab.average} / ${lab.max_points}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
