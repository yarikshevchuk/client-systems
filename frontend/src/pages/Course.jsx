import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import AgentDrawer from '../components/AgentDrawer.jsx'
import Announcements from '../components/Announcements.jsx'
import Content from '../components/Content.jsx'
import Discussion from '../components/Discussion.jsx'
import { Analytics, Gradebook, StudentGrades } from '../components/Grades.jsx'
import { Avatar, colorFor, Loading } from '../components/ui.jsx'

function Person({ person, role }) {
  return (
    <div className="item">
      <Avatar name={person.name} size={34} />
      <div className="grow">
        <strong>{person.name}</strong>
        <span className="muted small">{role} · {person.last_seen ? `в мережі ${timeAgo(person.last_seen)}` : 'ще не входив(ла)'}</span>
      </div>
      <div className="side"><Link className="btn secondary sm" to={`/messages/${person.id}`}>Написати</Link></div>
    </div>
  )
}

function People({ courseId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    api(`/courses/${courseId}/people`).then(setData)
  }, [courseId])

  if (!data) return <Loading />
  return (
    <>
      <h2 style={{ marginBottom: 6 }}>Викладач</h2>
      <Person person={data.teacher} role="Викладач" />
      <h2 style={{ margin: '24px 0 6px' }}>Студенти ({data.students.length})</h2>
      {data.students.map((student) => <Person key={student.id} person={student} role={`Група ${student.grp}`} />)}
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

  const load = () => api(`/courses/${id}`).then(setData).catch((err) => setError(err.message))

  useEffect(() => {
    setData(null)
    load()
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!data) return <Loading />

  const color = colorFor(data.course.id)
  const tabs = [['content', 'Матеріали'], ['announcements', 'Оголошення'], ['discussion', 'Обговорення'], ['people', 'Люди']]
  tabs.push(student ? ['grades', 'Мої оцінки'] : ['gradebook', 'Журнал оцінок'])
  if (data.can_manage) tabs.push(['analytics', 'Аналітика'])

  return (
    <>
      <div className="course-head" style={{ background: color }}>
        <h1>{data.course.title}</h1>
        <div className="byline">{data.course.teacher}</div>
      </div>
      <nav className="subnav">
        {tabs.map(([value, label]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setParams({ tab: value })}>{label}</button>
        ))}
        {data.can_manage && <Link to={`/courses/${id}/settings`}>Налаштування курсу</Link>}
      </nav>
      {tab === 'content' && <Content data={data} student={student} reload={load} />}
      {tab === 'announcements' && <Announcements courseId={id} canManage={data.can_manage} />}
      {tab === 'discussion' && <Discussion courseId={id} user={user} canManage={data.can_manage} />}
      {tab === 'people' && <People courseId={id} />}
      {tab === 'grades' && <StudentGrades courseId={id} color={color} />}
      {tab === 'gradebook' && <Gradebook courseId={id} />}
      {tab === 'analytics' && <Analytics courseId={id} />}
      <AgentDrawer courseId={data.course.id} />
    </>
  )
}
