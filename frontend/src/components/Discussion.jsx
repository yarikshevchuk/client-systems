import { useEffect, useRef, useState } from 'react'
import { api, download, plural, timeAgo } from '../api.js'
import { useLiveEvents } from '../live.jsx'
import { Avatar, Empty, Icon, Loading, Menu, Segmented, useToast } from './ui.jsx'

function FileLink({ message }) {
  if (!message.file_name) return null
  return <button className="file-chip" onClick={() => download(`/messages/${message.id}/file`, message.file_name)}><Icon name="file" size={14} />{message.file_name}</button>
}

function useMessages(courseId, channel) {
  const [messages, setMessages] = useState(null)

  function load() {
    api(`/courses/${courseId}/messages?channel=${channel}`).then(setMessages)
  }

  useEffect(() => {
    setMessages(null)
    load()
  }, [courseId, channel])

  useLiveEvents((event) => {
    const mine = event.message && event.message.course_id === Number(courseId) && event.message.channel === channel
    if (mine || (event.type === 'message_changed' && event.course_id === Number(courseId))) load()
  })

  return [messages, load]
}

function Composer({ placeholder, onSend, rows = 1, button = 'Надіслати', allowFile = false }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const input = useRef(null)

  async function submit(event) {
    event.preventDefault()
    if (!text.trim() && !file) return
    await onSend(text, file)
    setText('')
    setFile(null)
  }

  return (
    <form className="composer" onSubmit={submit}>
      {allowFile && (
        <>
          <input ref={input} type="file" hidden onChange={(e) => { setFile(e.target.files[0] || null); e.target.value = '' }} />
          <button type="button" className="icon-btn" title="Прикріпити файл" aria-label="Прикріпити файл" onClick={() => input.current.click()}><Icon name="upload" size={18} /></button>
        </>
      )}
      <div className="grow" style={{ flex: 1, minWidth: 0 }}>
        {rows > 1 ? (
          <textarea className="textarea" style={{ minHeight: 70 }} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          <input className="input" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        )}
        {file && <span className="file-chip" style={{ marginTop: 6 }}><Icon name="file" size={14} />{file.name}<button type="button" className="link-btn" onClick={() => setFile(null)}>×</button></span>}
      </div>
      <button type="submit" className="btn" disabled={!text.trim() && !file}><Icon name="send" size={16} />{button}</button>
    </form>
  )
}

async function postMessage(courseId, channel, text, file, parentId) {
  if (!file) return api(`/courses/${courseId}/messages`, { method: 'POST', body: { channel, text, parent_id: parentId || null } })
  const form = new FormData()
  form.append('channel', channel)
  form.append('text', text)
  if (parentId) form.append('parent_id', parentId)
  form.append('file', file)
  return api(`/courses/${courseId}/messages/file`, { method: 'POST', body: form })
}

function Thread({ question, replies, user, canManage, courseId, reload }) {
  const [replying, setReplying] = useState(false)
  const toast = useToast()

  async function reply(text, file) {
    try {
      await postMessage(courseId, question.channel, text, file, question.id)
      setReplying(false)
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function call(path, options) {
    try {
      await api(path, options)
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  const canAccept = question.user_id === user.id || canManage
  const canDelete = (message) => message.user_id === user.id || canManage

  return (
    <article className={question.resolved ? 'card thread resolved' : 'card thread'}>
      <div className="msg">
        <Avatar name={question.author} />
        <div className="grow">
          <div className="head">
            <strong>{question.author}</strong>
            {question.role === 'teacher' && <span className="badge accent">Викладач</span>}
            <span>{timeAgo(question.created_at)}</span>
            {question.resolved ? <span className="badge ok"><Icon name="check" size={12} />Є відповідь</span> : <span className="badge warn">Відкрите</span>}
          </div>
          <div className="body">{question.text}</div>
          <FileLink message={question} />
        </div>
        {canDelete(question) && <Menu items={[{ label: 'Видалити питання', danger: true, onClick: () => call(`/messages/${question.id}`, { method: 'DELETE' }) }]} />}
      </div>
      {replies.length > 0 && (
        <div className="replies">
          {replies.map((message) => (
            <div className={message.accepted ? 'msg reply accepted' : 'msg reply'} key={message.id}>
              <Avatar name={message.author} size={30} />
              <div className="grow">
                <div className="head">
                  <strong>{message.author}</strong>
                  {message.role === 'teacher' && <span className="badge accent">Викладач</span>}
                  <span>{timeAgo(message.created_at)}</span>
                  {message.accepted && <span className="badge ok"><Icon name="check" size={12} />Прийнята відповідь</span>}
                </div>
                <div className="body">{message.text}</div>
                <FileLink message={message} />
              </div>
              <div className="row">
                {canAccept && (
                  <button className="btn ghost sm" onClick={() => call(`/messages/${message.id}/accept`, { method: 'POST' })}>
                    {message.accepted ? 'Зняти позначку' : 'Прийняти'}
                  </button>
                )}
                {canDelete(message) && <Menu items={[{ label: 'Видалити', danger: true, onClick: () => call(`/messages/${message.id}`, { method: 'DELETE' }) }]} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {replying ? (
        <div style={{ marginTop: 12 }}>
          <Composer placeholder="Напишіть відповідь…" button="Відповісти" onSend={reply} allowFile />
        </div>
      ) : (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setReplying(true)}><Icon name="chat" size={14} />Відповісти</button>
      )}
    </article>
  )
}

function Questions({ courseId, user, canManage }) {
  const [messages, load] = useMessages(courseId, 'qa')
  const [filter, setFilter] = useState('all')
  const toast = useToast()

  async function ask(text, file) {
    try {
      await postMessage(courseId, 'qa', text, file)
      toast('Питання опубліковано')
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!messages) return <Loading />
  const questions = messages.filter((m) => !m.parent_id).reverse()
  const shown = questions.filter((q) => filter === 'all' || (filter === 'open' ? !q.resolved : q.resolved))

  return (
    <>
      <div className="card">
        <div className="card-title">
          <span className="icon-wrap"><Icon name="help" size={16} /></span>
          <h2>Поставити питання</h2>
        </div>
        <Composer placeholder="Що ви хочете дізнатися?" rows={2} button="Опублікувати питання" onSend={ask} allowFile />
      </div>
      <div className="row between wrap" style={{ margin: '20px 0 12px' }}>
        <h2>{questions.length} {plural(questions.length, 'питання', 'питання', 'питань')}</h2>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Усі' }, { value: 'open', label: 'Відкриті' }, { value: 'resolved', label: 'З відповіддю' }]} />
      </div>
      {shown.length === 0 && <Empty icon="chat">Тут немає питань.</Empty>}
      {shown.map((question) => (
        <Thread key={question.id} question={question} replies={messages.filter((m) => m.parent_id === question.id)} user={user} canManage={canManage} courseId={courseId} reload={load} />
      ))}
    </>
  )
}

function Chat({ courseId, user, canManage, channel }) {
  const [messages, load] = useMessages(courseId, channel.id)
  const bottom = useRef(null)
  const toast = useToast()

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  async function send(text, file) {
    try {
      await postMessage(courseId, channel.id, text, file)
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!messages) return <Loading />
  return (
    <div className="card">
      <div className="channel-head"><b># {channel.title}</b><span className="muted small">{channel.hint}</span></div>
      <div className="chat">
        {messages.length === 0 && <Empty icon="chat">У цьому каналі ще немає повідомлень.</Empty>}
        {messages.map((message) => (
          <div key={message.id} className="msg">
            <Avatar name={message.author} />
            <div className="bubble">
              <div className="head">
                <strong>{message.author}</strong>
                {message.role === 'teacher' && <span className="badge accent">Викладач</span>}
                <span>{timeAgo(message.created_at)}</span>
              </div>
              <div className="body">{message.text}</div>
              <FileLink message={message} />
            </div>
            {(message.user_id === user.id || canManage) && (
              <Menu items={[{ label: 'Видалити', danger: true, onClick: async () => { await api(`/messages/${message.id}`, { method: 'DELETE' }); load() } }]} />
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <Composer placeholder={`Написати в # ${channel.title}…`} onSend={send} allowFile />
    </div>
  )
}

export default function Discussion({ courseId, user, canManage }) {
  const [channels, setChannels] = useState(null)
  const [current, setCurrent] = useState('qa')

  useEffect(() => {
    api(`/courses/${courseId}/channels`).then(setChannels)
  }, [courseId])

  if (!channels) return <Loading />
  const channel = channels.find((item) => item.id === current) || channels[0]

  return (
    <div className="discussion-layout">
      <nav className="channel-list" aria-label="Канали курсу">
        {channels.map((item) => (
          <button key={item.id} className={item.id === channel.id ? 'active' : ''} onClick={() => setCurrent(item.id)} title={item.hint}>
            <span className="hash">#</span>{item.title}
          </button>
        ))}
      </nav>
      <div className="channel-main">
        {channel.id === 'qa' ? <Questions courseId={courseId} user={user} canManage={canManage} /> : <Chat key={channel.id} courseId={courseId} user={user} canManage={canManage} channel={channel} />}
      </div>
    </div>
  )
}
