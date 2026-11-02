import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import { useLive, useLiveEvents } from '../live.jsx'
import { Avatar, Empty, Icon, Loading, Modal, Select, useToast } from '../components/ui.jsx'

function NewConversation({ onClose, onPick }) {
  const [contacts, setContacts] = useState(null)
  const [picked, setPicked] = useState('')

  useEffect(() => {
    api('/contacts').then(setContacts)
  }, [])

  return (
    <Modal title="Нове повідомлення" onClose={onClose}>
      {!contacts ? <Loading /> : (
        <div className="stack">
          <div className="field">
            <span className="label">Кому ви хочете написати?</span>
            <Select
              value={picked}
              onChange={setPicked}
              placeholder="Оберіть людину"
              options={contacts.map((contact) => ({ value: contact.id, label: `${contact.name} · ${contact.role === 'teacher' ? 'викладач' : contact.role === 'admin' ? 'адмін' : contact.grp}` }))}
            />
          </div>
          <div className="modal-foot">
            <button className="btn secondary" onClick={onClose}>Скасувати</button>
            <button className="btn" disabled={!picked} onClick={() => onPick(picked)}>Почати чат</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Messages({ user }) {
  const { otherId } = useParams()
  const navigate = useNavigate()
  const { refresh } = useLive()
  const [conversations, setConversations] = useState(null)
  const [thread, setThread] = useState(null)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const bottom = useRef(null)
  const toast = useToast()

  function loadConversations() {
    api('/dm').then(setConversations)
  }

  function loadThread() {
    if (!otherId) return
    api(`/dm/${otherId}`).then((data) => {
      setThread(data)
      refresh()
      loadConversations()
    })
  }

  useEffect(loadConversations, [])
  useEffect(() => {
    setThread(null)
    loadThread()
  }, [otherId])
  useLiveEvents((event) => {
    if (event.type !== 'dm') return
    if (otherId && event.message.sender_id === Number(otherId)) loadThread()
    else loadConversations()
  })
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [thread])

  async function send(event) {
    event.preventDefault()
    if (!text.trim()) return
    try {
      await api(`/dm/${otherId}`, { method: 'POST', body: { text } })
      setText('')
      loadThread()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Повідомлення</h1>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Нове повідомлення</button>
      </div>
      <div className={otherId ? 'messages has-thread' : 'messages'}>
        <div className="card conv-list">
          {!conversations ? <Loading /> : conversations.length === 0 ? <Empty icon="chat">Розмов ще немає.</Empty> : conversations.map((item) => (
            <button key={item.user.id} className={Number(otherId) === item.user.id ? 'conv active' : 'conv'} onClick={() => navigate(`/messages/${item.user.id}`)}>
              <Avatar name={item.user.name} size={40} />
              <span className="grow">
                <strong>{item.user.name}</strong>
                <span className="muted small clip">{item.last.sender_id === user.id ? 'Ви: ' : ''}{item.last.text}</span>
              </span>
              <span className="meta">
                <span className="muted small">{timeAgo(item.last.created_at)}</span>
                {item.unread > 0 && <span className="count">{item.unread}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="card thread-pane">
          {!otherId ? (
            <Empty icon="chat">Оберіть розмову або почніть нову.</Empty>
          ) : !thread ? <Loading /> : (
            <>
              <div className="thread-head">
                <button className="icon-btn back" onClick={() => navigate('/messages')} aria-label="Назад"><Icon name="left" /></button>
                <Avatar name={thread.user.name} size={36} />
                <div>
                  <strong>{thread.user.name}</strong>
                  <div className="muted small">{{ teacher: 'Викладач', student: 'Студент', admin: 'Адміністратор' }[thread.user.role]}</div>
                </div>
              </div>
              <div className="chat tall">
                {thread.messages.length === 0 && <Empty icon="chat">Напишіть перше повідомлення.</Empty>}
                {thread.messages.map((message) => (
                  <div key={message.id} className={message.sender_id === user.id ? 'bubble-row mine' : 'bubble-row'}>
                    <div className="dm-bubble">
                      <div>{message.text}</div>
                      <span className="small">{timeAgo(message.created_at)}</span>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="composer" onSubmit={send}>
                <input className="input" placeholder="Напишіть повідомлення…" value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />Надіслати</button>
              </form>
            </>
          )}
        </div>
      </div>
      {adding && <NewConversation onClose={() => setAdding(false)} onPick={(id) => { setAdding(false); navigate(`/messages/${id}`) }} />}
    </>
  )
}
