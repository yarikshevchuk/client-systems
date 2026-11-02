import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import Announcements from '../components/Announcements.jsx'
import Content from '../components/Content.jsx'
import Discussion from '../components/Discussion.jsx'
import { Gradebook, StudentGrades } from '../components/Grades.jsx'
import { Avatar, colorFor, Icon, Loading } from '../components/ui.jsx'

function People({ courseId }) {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api(`/courses/${courseId}/people`).then(setData)
  }, [courseId])

  if (!data) return <Loading />
  const person = (row, role) => (
    <div className="item" key={row.id}>
      <Avatar name={row.name} size={34} />
      <div className="grow">
        <strong>{row.name}</strong>
        <span className="muted small">{role} · {row.last_seen ? `в мережі ${timeAgo(row.last_seen)}` : 'ще не входив(ла)'}</span>
      </div>
      <div className="side">
        <button className="btn secondary sm" onClick={() => navigate(`/messages/${row.id}`)}>Написати</button>
      </div>
    </div>
  )

  return (
    <>
      <h2 style={{ marginBottom: 6 }}>Викладач</h2>
      {person(data.teacher, 'Викладач')}
      <h2 style={{ margin: '24px 0 6px' }}>Студенти ({data.students.length})</h2>
      {data.students.map((row) => person(row, `Група ${row.grp}`))}
    </>
  )
}

export default function Course({ user }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const tab = params.get('tab') || 'content'
  const student = user.role === 'student'

  function load() {
    api(`/courses/${id}`).then(setData).catch((err) => setError(err.message))
  }

  useEffect(() => {
    setData(null)
    setError('')
    load()
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!data) return <Loading />

  const color = colorFor(data.course.id)
  const items = [
    ['content', 'Матеріали'],
    ['announcements', 'Оголошення'],
    ['discussion', 'Обговорення'],
    ['people', 'Люди'],
    student ? ['grades', 'Мої оцінки'] : ['gradebook', 'Журнал оцінок'],
  ]

  return (
    <>
      <div className="course-head">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <span className="muted">Курс · група {data.course.grp}</span>
        </div>
        <h1>{data.course.title}</h1>
        <p className="row" style={{ gap: 8, marginTop: 8 }}>
          <Avatar name={data.course.teacher} size={22} />
          <span>{data.course.teacher}</span>
        </p>
        {data.course.description && <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>{data.course.description}</p>}
      </div>
      <div className="course-layout">
        <nav className="subnav">
          {items.map(([value, label]) => (
            <button key={value} className={tab === value ? 'active' : ''} onClick={() => setParams(value === 'content' ? {} : { tab: value })}>{label}</button>
          ))}
          {data.can_manage && <Link to={`/courses/${id}/settings`}>Налаштування курсу</Link>}
        </nav>
        <div>
          {tab === 'content' && <Content data={data} canManage={data.can_manage} student={student} reload={load} />}
          {tab === 'announcements' && <Announcements courseId={id} canManage={data.can_manage} />}
          {tab === 'discussion' && <Discussion courseId={id} user={user} canManage={data.can_manage} />}
          {tab === 'people' && <People courseId={id} />}
          {tab === 'grades' && student && <StudentGrades courseId={id} color={color} />}
          {tab === 'gradebook' && !student && <Gradebook courseId={id} />}
        </div>
      </div>
    </>
  )
}
