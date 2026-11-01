import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { Avatar, Empty, Icon, Loading } from '../components/ui.jsx'

function Group({ title, icon, children }) {
  return (
    <div className="section">
      <div className="section-head"><h2><Icon name={icon} size={16} /> {title}</h2></div>
      {children}
    </div>
  )
}

export default function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    api(`/search?q=${encodeURIComponent(q)}`).then(setData)
  }, [q])

  if (!data) return <Loading />
  const total = Object.values(data).reduce((sum, list) => sum + list.length, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Пошук</h1>
          <p>{q.length < 2 ? 'Введіть щонайменше дві літери в полі пошуку.' : `Результатів: ${total} за запитом «${q}»`}</p>
        </div>
      </div>
      {q.length >= 2 && total === 0 && <Empty icon="search">Нічого не знайдено. Спробуйте інше слово.</Empty>}
      {data.courses.length > 0 && (
        <Group title="Курси" icon="book">
          {data.courses.map((row) => (
            <Link className="item" to={`/courses/${row.id}`} key={row.id}>
              <span className="icon-wrap"><Icon name="book" size={20} /></span>
              <div className="grow"><strong>{row.title}</strong><span className="muted small clip">{row.description}</span></div>
            </Link>
          ))}
        </Group>
      )}
      {data.materials.length > 0 && (
        <Group title="Матеріали" icon="file">
          {data.materials.map((row) => (
            <Link className="item" to={`/materials/${row.id}`} key={row.id}>
              <span className="icon-wrap accent"><Icon name={row.kind === 'lab' ? 'file' : 'book'} size={20} /></span>
              <div className="grow"><strong>{row.title}</strong><span className="muted small">{row.course_title} · {row.kind === 'lab' ? 'лабораторна' : 'лекція'}</span></div>
            </Link>
          ))}
        </Group>
      )}
      {data.announcements.length > 0 && (
        <Group title="Оголошення" icon="megaphone">
          {data.announcements.map((row) => (
            <Link className="item" to={`/courses/${row.course_id}?tab=announcements`} key={row.id}>
              <span className="icon-wrap"><Icon name="megaphone" size={20} /></span>
              <div className="grow"><strong>{row.title}</strong><span className="muted small">{row.course_title}</span></div>
            </Link>
          ))}
        </Group>
      )}
      {data.messages.length > 0 && (
        <Group title="Обговорення" icon="chat">
          {data.messages.map((row) => (
            <Link className="item" to={`/courses/${row.course_id}?tab=discussion`} key={row.id}>
              <span className="icon-wrap"><Icon name="chat" size={20} /></span>
              <div className="grow"><strong className="clip">{row.text}</strong><span className="muted small">{row.author} · {row.course_title}</span></div>
            </Link>
          ))}
        </Group>
      )}
      {data.spaces.length > 0 && (
        <Group title="Навчальні простори" icon="users">
          {data.spaces.map((row) => (
            <Link className="item" to={`/spaces/${row.id}`} key={row.id}>
              <span className="icon-wrap"><Icon name="users" size={20} /></span>
              <div className="grow"><strong>{row.title}</strong><span className="muted small">{row.topic}</span></div>
            </Link>
          ))}
        </Group>
      )}
      {data.people.length > 0 && (
        <Group title="Люди" icon="user">
          {data.people.map((row) => (
            <Link className="item" to={`/messages/${row.id}`} key={row.id}>
              <Avatar name={row.name} size={40} />
              <div className="grow"><strong>{row.name}</strong><span className="muted small">{row.role === 'teacher' ? 'Викладач' : row.grp}</span></div>
              <div className="side"><span className="badge"><Icon name="chat" size={12} />Написати</span></div>
            </Link>
          ))}
        </Group>
      )}
    </>
  )
}
