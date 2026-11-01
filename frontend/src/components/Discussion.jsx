import { useEffect, useRef, useState } from 'react'
import { api, timeAgo } from '../api.js'
import { useLiveEvents } from '../live.jsx'
import { Avatar, Empty, Icon, Loading, Menu, Segmented, useToast } from './ui.jsx'

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

function Composer({ placeholder, onSend, rows = 1, button = 'Send' }) {
  const [text, setText] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!text.trim()) return
    await onSend(text)
    setText('')
  }

  return (
    <form className="composer" onSubmit={submit}>
      {rows > 1 ? (
        <textarea className="textarea" style={{ minHeight: 70 }} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <input className="input" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      )}
      <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />{button}</button>
    </form>
  )
}

function Thread({ question, replies, user, canManage, courseId, reload }) {
  const [replying, setReplying] = useState(false)
  const toast = useToast()

  async function reply(text) {
    try {
      await api(`/courses/${courseId}/messages`, { method: 'POST', body: { text, parent_id: question.id } })
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
            {question.role === 'teacher' && <span className="badge accent">Lecturer</span>}
            <span>{timeAgo(question.created_at)}</span>
            {question.resolved ? <span className="badge ok"><Icon name="check" size={12} />Answered</span> : <span className="badge warn">Open</span>}
          </div>
          <div className="body">{question.text}</div>
        </div>
        {canDelete(question) && <Menu items={[{ label: 'Delete question', danger: true, onClick: () => call(`/messages/${question.id}`, { method: 'DELETE' }) }]} />}
      </div>
      {replies.length > 0 && (
        <div className="replies">
          {replies.map((message) => (
            <div className={message.accepted ? 'msg reply accepted' : 'msg reply'} key={message.id}>
              <Avatar name={message.author} size={30} />
              <div className="grow">
                <div className="head">
                  <strong>{message.author}</strong>
                  {message.role === 'teacher' && <span className="badge accent">Lecturer</span>}
                  <span>{timeAgo(message.created_at)}</span>
                  {message.accepted && <span className="badge ok"><Icon name="check" size={12} />Accepted answer</span>}
                </div>
                <div className="body">{message.text}</div>
              </div>
              <div className="row">
                {canAccept && (
                  <button className="btn ghost sm" onClick={() => call(`/messages/${message.id}/accept`, { method: 'POST' })}>
                    {message.accepted ? 'Unmark' : 'Accept'}
                  </button>
                )}
                {canDelete(message) && <Menu items={[{ label: 'Delete', danger: true, onClick: () => call(`/messages/${message.id}`, { method: 'DELETE' }) }]} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {replying ? (
        <div style={{ marginTop: 12 }}>
          <Composer placeholder="Write an answer…" button="Reply" onSend={reply} />
        </div>
      ) : (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setReplying(true)}><Icon name="chat" size={14} />Reply</button>
      )}
    </article>
  )
}

function Questions({ courseId, user, canManage }) {
  const [messages, load] = useMessages(courseId, 'qa')
  const [filter, setFilter] = useState('all')
  const toast = useToast()

  async function ask(text) {
    try {
      await api(`/courses/${courseId}/messages`, { method: 'POST', body: { channel: 'qa', text } })
      toast('Question posted')
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
          <h2>Ask a question</h2>
        </div>
        <Composer placeholder="What would you like to know?" rows={2} button="Post question" onSend={ask} />
      </div>
      <div className="row between wrap" style={{ margin: '20px 0 12px' }}>
        <h2>{questions.length} {questions.length === 1 ? 'question' : 'questions'}</h2>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'resolved', label: 'Answered' }]} />
      </div>
      {shown.length === 0 && <Empty icon="chat">No questions here.</Empty>}
      {shown.map((question) => (
        <Thread key={question.id} question={question} replies={messages.filter((m) => m.parent_id === question.id)} user={user} canManage={canManage} courseId={courseId} reload={load} />
      ))}
    </>
  )
}

function General({ courseId, user, canManage }) {
  const [messages, load] = useMessages(courseId, 'general')
  const bottom = useRef(null)
  const toast = useToast()

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  async function send(text) {
    try {
      await api(`/courses/${courseId}/messages`, { method: 'POST', body: { channel: 'general', text } })
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!messages) return <Loading />
  return (
    <div className="card">
      <div className="chat">
        {messages.length === 0 && <Empty icon="chat">No messages yet. Say hello.</Empty>}
        {messages.map((message) => (
          <div key={message.id} className="msg">
            <Avatar name={message.author} />
            <div className="bubble">
              <div className="head">
                <strong>{message.author}</strong>
                {message.role === 'teacher' && <span className="badge accent">Lecturer</span>}
                <span>{timeAgo(message.created_at)}</span>
              </div>
              <div className="body">{message.text}</div>
            </div>
            {(message.user_id === user.id || canManage) && (
              <Menu items={[{ label: 'Delete', danger: true, onClick: async () => { await api(`/messages/${message.id}`, { method: 'DELETE' }); load() } }]} />
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <Composer placeholder="Write a message to the course…" onSend={send} />
    </div>
  )
}

export default function Discussion({ courseId, user, canManage }) {
  const [channel, setChannel] = useState('qa')
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Segmented value={channel} onChange={setChannel} options={[{ value: 'qa', label: 'Q&A' }, { value: 'general', label: 'General chat' }]} />
      </div>
      {channel === 'qa' ? <Questions courseId={courseId} user={user} canManage={canManage} /> : <General courseId={courseId} user={user} canManage={canManage} />}
    </>
  )
}
