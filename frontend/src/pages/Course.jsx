import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import Announcements from '../components/Announcements.jsx'
import Content from '../components/Content.jsx'
import Discussion from '../components/Discussion.jsx'
import { Gradebook, StudentGrades } from '../components/Grades.jsx'
import { Avatar, colorFor, Icon, Loading, Tabs } from '../components/ui.jsx'

function People({ courseId }) {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api(`/courses/${courseId}/people`).then(setData)
  }, [courseId])

  if (!data) return <Loading />
  const person = (row, role) => (
    <div className="item" key={row.id}>
      <Avatar name={row.name} size={40} />
      <div className="grow">
        <strong>{row.name}</strong>
        <span className="muted small">{role} · {row.last_seen ? `в мережі ${timeAgo(row.last_seen)}` : 'ще не входив(ла)'}</span>
      </div>
      <div className="side">
        <button className="btn secondary sm" onClick={() => navigate(`/messages/${row.id}`)}><Icon name="chat" size={14} />Написати</button>
      </div>
    </div>
  )

  return (
    <>
      <h2 style={{ marginBottom: 12 }}>Викладач</h2>
      {person(data.teacher, 'Викладач')}
      <h2 style={{ margin: '24px 0 12px' }}>Студенти ({data.students.length})</h2>
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
  const tabs = [
    { value: 'content', label: 'Матеріали', icon: 'layers' },
    { value: 'announcements', label: 'Оголошення', icon: 'megaphone' },
    { value: 'discussion', label: 'Обговорення', icon: 'chat' },
    { value: 'people', label: 'Люди', icon: 'users' },
    student ? { value: 'grades', label: 'Оцінки', icon: 'award' } : { value: 'gradebook', label: 'Журнал', icon: 'award' },
  ]

  return (
    <>
      <Link to="/" className="crumb"><Icon name="left" size={16} />Головна</Link>
      <div className="course-head" style={{ '--stripe': color }}>
        <div>
          <h1>{data.course.title}</h1>
          {data.course.description && <p className="muted" style={{ marginTop: 6, maxWidth: 640 }}>{data.course.description}</p>}
          <p className="row wrap" style={{ gap: 8, marginTop: 12 }}>
            <Avatar name={data.course.teacher} size={22} />
            <span>{data.course.teacher}</span>
            <span className="badge">Група {data.course.grp}</span>
          </p>
        </div>
        {data.can_manage && <Link className="btn secondary" to={`/courses/${id}/settings`}><Icon name="sliders" size={16} />Налаштування курсу</Link>}
      </div>
      <Tabs value={tab} onChange={(value) => setParams(value === 'content' ? {} : { tab: value })} options={tabs} />
      {tab === 'content' && <Content data={data} canManage={data.can_manage} student={student} reload={load} />}
      {tab === 'announcements' && <Announcements courseId={id} canManage={data.can_manage} />}
      {tab === 'discussion' && <Discussion courseId={id} user={user} canManage={data.can_manage} />}
      {tab === 'people' && <People courseId={id} />}
      {tab === 'grades' && student && <StudentGrades courseId={id} color={color} />}
      {tab === 'gradebook' && !student && <Gradebook courseId={id} />}
    </>
  )
}
