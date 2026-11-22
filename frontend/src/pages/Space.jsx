import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, download, timeAgo } from '../api.js'
import { useLive } from '../live.js'
import { Avatar, Choice, Empty, Icon, Loading } from '../components/ui.jsx'
import { t } from '../i18n.js'

const COLUMNS = [['todo', t("Треба зробити")], ['doing', t("У роботі")], ['done', t("Готово")]]
const PREVIOUS = { doing: 'todo', done: 'doing' }
const NEXT = { todo: 'doing', doing: 'done' }

function Board({ spaceId, tasks, members, reload }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')

  async function call(path, options) {
    await api(path, options)
    reload()
  }

  async function add(event) {
    event.preventDefault()
    await call(`/spaces/${spaceId}/tasks`, { method: 'POST', body: { title, assignee_id: assignee || null } })
    setTitle('')
  }

  const move = (task, status) => call(`/space-tasks/${task.id}`, { method: 'PUT', body: { status } })

  return (
    <>
      <form className="task-form" onSubmit={add}>
        <input className="input" placeholder={t("Нова задача команди…")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">{t("Без виконавця")}</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <button className="btn" disabled={!title.trim()}><Icon name="plus" size={16} />{t("Додати")}</button>
      </form>
      <div className="board">
        {COLUMNS.map(([status, label]) => {
          const column = tasks.filter((task) => task.status === status)
          return (
            <div className="board-col" key={status}>
              <div className="board-head">{label}<span className="badge">{column.length}</span></div>
              {column.map((task) => (
                <div className="task" key={task.id}>
                  <div className={status === 'done' ? 'task-title done' : 'task-title'}>{task.title}</div>
                  <div className="row between">
                    <span className="muted small">{task.assignee || t("Без виконавця")}</span>
                    <div className="row" style={{ gap: 2 }}>
                      {PREVIOUS[status] && <button className="icon-btn" title={t("Назад")} onClick={() => move(task, PREVIOUS[status])}><Icon name="left" size={16} /></button>}
                      {NEXT[status] && <button className="icon-btn" title={t("Далі")} onClick={() => move(task, NEXT[status])}><Icon name="right" size={16} /></button>}
                      <button className="icon-btn" title={t("Видалити")} onClick={() => call(`/space-tasks/${task.id}`, { method: 'DELETE' })}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {column.length === 0 && <p className="muted small" style={{ padding: '6px 2px' }}>{t("Порожньо")}</p>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Files({ spaceId, files, user, reload }) {
  async function upload(event) {
    const form = new FormData()
    form.append('file', event.target.files[0])
    await api(`/spaces/${spaceId}/files`, { method: 'POST', body: form }).catch((err) => alert(err.message))
    reload()
  }

  async function remove(file) {
    await api(`/space-files/${file.id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <>
      <label className="btn secondary"><Icon name="upload" size={16} />{t("Додати файл")}<input type="file" hidden onChange={upload} /></label>
      <div style={{ marginTop: 14 }}>
        {files.length === 0 && <Empty icon="file">{t("Спільних файлів ще немає.")}</Empty>}
        {files.map((file) => (
          <div className="file-row" key={file.id}>
            <Icon name="file" size={18} />
            <button className="link-btn grow" onClick={() => download(`/space-files/${file.id}/file`, file.filename)}>{file.filename}</button>
            <span className="muted small">{file.author} · {timeAgo(file.created_at)}</span>
            {file.user_id === user.id && <button className="icon-btn" title={t("Видалити файл")} onClick={() => remove(file)}><Icon name="trash" size={16} /></button>}
          </div>
        ))}
      </div>
    </>
  )
}

function Chat({ spaceId, messages, reload }) {
  const [text, setText] = useState('')

  async function send(event) {
    event.preventDefault()
    await api(`/spaces/${spaceId}/messages`, { method: 'POST', body: { text } })
    setText('')
    reload()
  }

  return (
    <>
      <div className="chat">
        {messages.length === 0 && <Empty icon="chat">{t("Повідомлень ще немає. Почніть розмову.")}</Empty>}
        {messages.map((message) => (
          <div key={message.id} className="msg">
            <Avatar name={message.author} />
            <div className="bubble">
              <div className="head"><strong>{message.author}</strong><span>{timeAgo(message.created_at)}</span></div>
              <div className="body">{message.text}</div>
            </div>
          </div>
        ))}
        <div ref={(end) => end?.scrollIntoView({ block: 'nearest' })} />
      </div>
      <form className="composer" onSubmit={send}>
        <input className="input" placeholder={t("Напишіть у простір…")} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />{t("Надіслати")}</button>
      </form>
    </>
  )
}

export default function Space({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('chat')

  const load = () => api(`/spaces/${id}`).then(setData).catch((err) => setError(err.message))

  useEffect(() => {
    setData(null)
    load()
  }, [id])

  useLive((event) => {
    if (event.message?.space_id === Number(id) || event.space_id === Number(id)) load()
  })

  async function post(path) {
    await api(path, { method: 'POST' })
    load()
  }

  async function remove() {
    if (!confirm(t("Видалити цей простір разом з усіма повідомленнями?"))) return
    await api(`/spaces/${id}`, { method: 'DELETE' })
    navigate('/spaces')
  }

  if (error) return <p className="error">{error}</p>
  if (!data) return <Loading />
  const { space, joined, members, messages, tasks, files } = data
  const owner = space.owner_id === user.id

  return (
    <>
      <Link to="/spaces" className="crumb"><Icon name="left" size={16} />{t("Навчальні простори")}</Link>
      <div className="page-head">
        <div>
          <h1>{space.title}</h1>
          <p className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            {space.topic && <span className="badge">{space.topic}</span>}
            <span>{t("Створив(ла)")} {space.owner}</span>
          </p>
          {space.description && <p style={{ marginTop: 8 }}>{space.description}</p>}
        </div>
        <div className="row">
          {joined && !owner && <button className="btn secondary" onClick={() => post(`/spaces/${id}/leave`)}>{t("Залишити")}</button>}
          {!joined && <button className="btn" onClick={() => post(`/spaces/${id}/join`)}><Icon name="plus" size={16} />{t("Приєднатися")}</button>}
          {(owner || user.role === 'admin') && <button className="btn secondary" onClick={remove}><Icon name="trash" size={16} />{t("Видалити")}</button>}
        </div>
      </div>

      <div className="space-layout">
        <div className="card">
          {!joined && <Empty icon="users">{t("Приєднайтеся до простору, щоб бачити чат, задачі й файли.")}</Empty>}
          {joined && (
            <>
              <Choice className="tabs" value={tab} onChange={setTab} options={[['chat', t("Чат")], ['tasks', `${t("Задачі")} (${tasks.length})`], ['files', `${t("Файли")} (${files.length})`]]} />
              {tab === 'chat' && <Chat spaceId={space.id} messages={messages} reload={load} />}
              {tab === 'tasks' && <Board spaceId={space.id} tasks={tasks} members={members} reload={load} />}
              {tab === 'files' && <Files spaceId={space.id} files={files} user={user} reload={load} />}
            </>
          )}
        </div>
        <div className="card">
          <div className="card-title"><h2>{t("Учасники й внесок")}</h2></div>
          {members.map((member) => (
            <div className="member-row" key={member.id}>
              <Avatar name={member.name} size={30} />
              <div className="grow">
                <div className="row" style={{ gap: 6 }}>
                  <span>{member.name}</span>
                  {member.role === 'teacher' && <span className="badge accent">{t("Викладач")}</span>}
                  {member.id === space.owner_id && <span className="badge">{t("Власник")}</span>}
                </div>
                <span className="muted small">{t("Виконано задач:")} {member.done} {t("· у роботі:")} {member.open} {t("· повідомлень:")} {member.posts} {t("· файлів:")} {member.files}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
