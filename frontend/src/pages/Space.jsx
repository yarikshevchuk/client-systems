import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, download, timeAgo } from '../api.js'
import { useLiveEvents } from '../live.jsx'
import { Avatar, Confirm, Empty, Icon, Loading, Select, Tabs, useToast } from '../components/ui.jsx'

const COLUMNS = [['todo', 'Треба зробити'], ['doing', 'У роботі'], ['done', 'Готово']]

function Board({ spaceId, tasks, members, reload }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(null)
  const toast = useToast()
  const people = [{ value: '', label: 'Без виконавця' }, ...members.map((m) => ({ value: m.id, label: m.name }))]

  async function call(path, options) {
    try {
      await api(path, options)
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function add(event) {
    event.preventDefault()
    await call(`/spaces/${spaceId}/tasks`, { method: 'POST', body: { title, assignee_id: assignee || null } })
    setTitle('')
  }

  return (
    <>
      <form className="task-form" onSubmit={add}>
        <input className="input" placeholder="Нова задача команди…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ minWidth: 180 }}><Select value={assignee ?? ''} onChange={(value) => setAssignee(value || null)} options={people} /></div>
        <button className="btn" disabled={!title.trim()}><Icon name="plus" size={16} />Додати</button>
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
                    <span className="muted small">{task.assignee || 'Без виконавця'}</span>
                    <div className="row" style={{ gap: 2 }}>
                      {status !== 'todo' && <button className="icon-btn" title="Назад" onClick={() => call(`/space-tasks/${task.id}`, { method: 'PUT', body: { status: status === 'done' ? 'doing' : 'todo' } })}><Icon name="left" size={16} /></button>}
                      {status !== 'done' && <button className="icon-btn" title="Далі" onClick={() => call(`/space-tasks/${task.id}`, { method: 'PUT', body: { status: status === 'todo' ? 'doing' : 'done' } })}><Icon name="right" size={16} /></button>}
                      <button className="icon-btn" title="Видалити" onClick={() => call(`/space-tasks/${task.id}`, { method: 'DELETE' })}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {column.length === 0 && <p className="muted small" style={{ padding: '6px 2px' }}>Порожньо</p>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Files({ spaceId, files, user, reload }) {
  const input = useRef(null)
  const toast = useToast()

  async function upload(event) {
    const file = event.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      await api(`/spaces/${spaceId}/files`, { method: 'POST', body: form })
      toast('Файл додано')
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
    event.target.value = ''
  }

  return (
    <>
      <input ref={input} type="file" hidden onChange={upload} />
      <button className="btn secondary" onClick={() => input.current.click()}><Icon name="upload" size={16} />Додати файл</button>
      <div style={{ marginTop: 14 }}>
        {files.length === 0 && <Empty icon="file">Спільних файлів ще немає.</Empty>}
        {files.map((file) => (
          <div className="file-row" key={file.id}>
            <Icon name="file" size={18} />
            <button className="link-btn grow" onClick={() => download(`/space-files/${file.id}/file`, file.filename)}>{file.filename}</button>
            <span className="muted small">{file.author} · {timeAgo(file.created_at)}</span>
            {file.user_id === user.id && <button className="icon-btn" aria-label="Видалити файл" onClick={async () => { await api(`/space-files/${file.id}`, { method: 'DELETE' }); reload() }}><Icon name="trash" size={16} /></button>}
          </div>
        ))}
      </div>
    </>
  )
}

export default function Space({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [text, setText] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('chat')
  const bottom = useRef(null)
  const toast = useToast()

  function load() {
    api(`/spaces/${id}`).then(setData).catch((err) => setError(err.message))
  }

  useEffect(() => {
    setData(null)
    load()
  }, [id])
  useLiveEvents((event) => {
    if ((event.type === 'space_message' && event.message.space_id === Number(id)) || (event.type === 'space_changed' && event.space_id === Number(id))) load()
  })
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [data])

  async function act(path, message) {
    try {
      await api(path, { method: 'POST' })
      if (message) toast(message)
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function send(event) {
    event.preventDefault()
    if (!text.trim()) return
    try {
      await api(`/spaces/${id}/messages`, { method: 'POST', body: { text } })
      setText('')
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function remove() {
    await api(`/spaces/${id}`, { method: 'DELETE' })
    toast('Простір видалено')
    navigate('/spaces')
  }

  if (error) return <p className="error">{error}</p>
  if (!data) return <Loading />
  const { space, joined, members, messages, tasks, files } = data
  const owner = space.owner_id === user.id

  return (
    <>
      <Link to="/spaces" className="crumb"><Icon name="left" size={16} />Навчальні простори</Link>
      <div className="page-head">
        <div>
          <h1>{space.title}</h1>
          <p className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            {space.topic && <span className="badge">{space.topic}</span>}
            <span>Створив(ла) {space.owner}</span>
          </p>
          {space.description && <p style={{ marginTop: 8 }}>{space.description}</p>}
        </div>
        <div className="row">
          {joined && !owner && <button className="btn secondary" onClick={() => act(`/spaces/${id}/leave`, 'Ви залишили простір')}>Залишити</button>}
          {!joined && <button className="btn" onClick={() => act(`/spaces/${id}/join`, 'Ви приєдналися до простору')}><Icon name="plus" size={16} />Приєднатися</button>}
          {(owner || user.role === 'admin') && <button className="btn secondary" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Видалити</button>}
        </div>
      </div>
      <div className="space-layout">
        <div className="card">
          {!joined ? (
            <Empty icon="users">Приєднайтеся до простору, щоб бачити чат, задачі й файли.</Empty>
          ) : (
            <>
              <Tabs value={tab} onChange={setTab} options={[{ value: 'chat', label: 'Чат' }, { value: 'tasks', label: `Задачі (${tasks.length})` }, { value: 'files', label: `Файли (${files.length})` }]} />
              {tab === 'tasks' && <Board spaceId={space.id} tasks={tasks} members={members} reload={load} />}
              {tab === 'files' && <Files spaceId={space.id} files={files} user={user} reload={load} />}
              {tab === 'chat' && <>
              <div className="chat">
                {messages.length === 0 && <Empty icon="chat">Повідомлень ще немає. Почніть розмову.</Empty>}
                {messages.map((message) => (
                  <div key={message.id} className="msg">
                    <Avatar name={message.author} />
                    <div className="bubble">
                      <div className="head"><strong>{message.author}</strong><span>{timeAgo(message.created_at)}</span></div>
                      <div className="body">{message.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="composer" onSubmit={send}>
                <input className="input" placeholder="Напишіть у простір…" value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />Надіслати</button>
              </form>
              </>}
            </>
          )}
        </div>
        <div className="card">
          <div className="card-title"><h2>Учасники й внесок</h2></div>
          {members.map((member) => (
            <div className="member-row" key={member.id}>
              <Avatar name={member.name} size={30} />
              <div className="grow">
                <div className="row" style={{ gap: 6 }}>
                  <span>{member.name}</span>
                  {member.role === 'teacher' && <span className="badge accent">Викладач</span>}
                  {member.id === space.owner_id && <span className="badge">Власник</span>}
                </div>
                <span className="muted small">Виконано задач: {member.done} · у роботі: {member.open} · повідомлень: {member.posts} · файлів: {member.files}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {confirm && <Confirm title="Видалити простір" text="Видалити цей простір разом з усіма повідомленнями?" onConfirm={remove} onClose={() => setConfirm(false)} />}
    </>
  )
}
