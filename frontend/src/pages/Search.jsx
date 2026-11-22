import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { Avatar, Empty, Icon, Loading } from '../components/ui.jsx'
import { t } from '../i18n.js'

function Result({ to, icon, title, subtitle }) {
  return (
    <Link className="item" to={to}>
      <span className="icon-wrap"><Icon name={icon} size={20} /></span>
      <div className="grow"><strong className="clip">{title}</strong><span className="muted small clip">{subtitle}</span></div>
    </Link>
  )
}

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
          <h1>{t("Пошук")}</h1>
          <p>{q.length < 2 ? t("Введіть щонайменше дві літери в полі пошуку.") : t("Результатів: {total} за запитом «{q}»", { total, q })}</p>
        </div>
      </div>
      {q.length >= 2 && total === 0 && <Empty icon="search">{t("Нічого не знайдено. Спробуйте інше слово.")}</Empty>}
      {data.courses.length > 0 && (
        <Group title={t("Курси")} icon="book">
          {data.courses.map((row) => <Result key={row.id} to={`/courses/${row.id}`} icon="book" title={row.title} subtitle={row.description} />)}
        </Group>
      )}
      {data.materials.length > 0 && (
        <Group title={t("Матеріали")} icon="file">
          {data.materials.map((row) => <Result key={row.id} to={`/materials/${row.id}`} icon={row.kind === 'lab' ? 'file' : 'book'} title={row.title} subtitle={`${row.course_title} · ${row.kind === 'lab' ? t("лабораторна") : t("лекція")}`} />)}
        </Group>
      )}
      {data.announcements.length > 0 && (
        <Group title={t("Оголошення")} icon="megaphone">
          {data.announcements.map((row) => <Result key={row.id} to={`/courses/${row.course_id}?tab=announcements`} icon="megaphone" title={row.title} subtitle={row.course_title} />)}
        </Group>
      )}
      {data.messages.length > 0 && (
        <Group title={t("Обговорення")} icon="chat">
          {data.messages.map((row) => <Result key={row.id} to={`/courses/${row.course_id}?tab=discussion`} icon="chat" title={row.text} subtitle={`${row.author} · ${row.course_title}`} />)}
        </Group>
      )}
      {data.spaces.length > 0 && (
        <Group title={t("Навчальні простори")} icon="users">
          {data.spaces.map((row) => <Result key={row.id} to={`/spaces/${row.id}`} icon="users" title={row.title} subtitle={row.topic} />)}
        </Group>
      )}
      {data.people.length > 0 && (
        <Group title={t("Люди")} icon="user">
          {data.people.map((row) => (
            <Link className="item" to={`/messages/${row.id}`} key={row.id}>
              <Avatar name={row.name} size={40} />
              <div className="grow"><strong>{row.name}</strong><span className="muted small">{row.role === 'teacher' ? t("Викладач") : row.grp}</span></div>
              <div className="side"><span className="badge"><Icon name="chat" size={12} />{t("Написати")}</span></div>
            </Link>
          ))}
        </Group>
      )}
    </>
  )
}
