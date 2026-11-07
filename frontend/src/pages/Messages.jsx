import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, roleName, timeAgo } from '../api.js'
import { useLive } from '../live.js'
import { Avatar, Empty, Icon, Loading, Modal } from '../components/ui.jsx'
import { t } from '../i18n.js'

function NewConversation({ onClose, onPick }) {
  const [contacts, setContacts] = useState(null)
  const [picked, setPicked] = useState('')

  useEffect(() => {
    api('/contacts').then(setContacts)
  }, [])

  return (
    <Modal title={t("Нове повідомлення")} onClose={onClose}>
      {!contacts ? <Loading /> : (
        <div className="stack">
          <label className="field">
            <span className="label">{t("Кому ви хочете написати?")}</span>
            <select className="input" value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">{t("Оберіть людину")}</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.grp || roleName(contact.role)}</option>)}
            </select>
          </label>
          <div className="modal-foot">
            <button className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
            <button className="btn" disabled={!picked} onClick={() => onPick(picked)}>{t("Почати чат")}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Messages({ user, onRead }) {
  const { otherId } = useParams()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState(null)
  const [thread, setThread] = useState(null)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)

  const loadConversations = () => api('/dm').then(setConversations)

  async function loadThread() {
    if (!otherId) return
    setThread(await api(`/dm/${otherId}`))
    loadConversations()
    onRead()
  }

  useEffect(() => { loadConversations() }, [])
  useEffect(() => {
    setThread(null)
    loadThread()
  }, [otherId])

  useLive((event) => {
    if (event.type === 'dm' && event.message.sender_id === Number(otherId)) loadThread()
    else if (event.type === 'dm') loadConversations()
  })

  async function send(event) {
    event.preventDefault()
    await api(`/dm/${otherId}`, { method: 'POST', body: { text } })
    setText('')
    loadThread()
  }

  return (
    <>
      <div className="page-head">
        <h1>{t("Повідомлення")}</h1>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{t("Нове повідомлення")}</button>
      </div>
      <div className={otherId ? 'messages has-thread' : 'messages'}>
        <div className="card conv-list">
          {!conversations && <Loading />}
          {conversations?.length === 0 && <Empty icon="chat">{t("Розмов ще немає.")}</Empty>}
          {conversations?.map((item) => (
            <Link key={item.user.id} to={`/messages/${item.user.id}`} className={Number(otherId) === item.user.id ? 'conv active' : 'conv'}>
              <Avatar name={item.user.name} size={40} />
              <span className="grow">
                <strong>{item.user.name}</strong>
                <span className="muted small clip">{item.last.sender_id === user.id && t("Ви: ")}{item.last.text}</span>
              </span>
              <span className="meta">
                <span className="muted small">{timeAgo(item.last.created_at)}</span>
                {item.unread > 0 && <span className="count">{item.unread}</span>}
              </span>
            </Link>
          ))}
        </div>

        <div className="card thread-pane">
          {!otherId && <Empty icon="chat">{t("Оберіть розмову або почніть нову.")}</Empty>}
          {otherId && !thread && <Loading />}
          {otherId && thread && (
            <>
              <div className="thread-head">
                <Link className="icon-btn back" to="/messages" aria-label={t("Назад")}><Icon name="left" /></Link>
                <Avatar name={thread.user.name} size={36} />
                <div>
                  <strong>{thread.user.name}</strong>
                  <div className="muted small">{roleName(thread.user.role)}</div>
                </div>
              </div>
              <div className="chat tall">
                {thread.messages.length === 0 && <Empty icon="chat">{t("Напишіть перше повідомлення.")}</Empty>}
                {thread.messages.map((message) => (
                  <div key={message.id} className={message.sender_id === user.id ? 'bubble-row mine' : 'bubble-row'}>
                    <div className="dm-bubble">
                      <div>{message.text}</div>
                      <span className="small">{timeAgo(message.created_at)}</span>
                    </div>
                  </div>
                ))}
                <div ref={(end) => end?.scrollIntoView({ block: 'nearest' })} />
              </div>
              <form className="composer" onSubmit={send}>
                <input className="input" placeholder={t("Напишіть повідомлення…")} value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />{t("Надіслати")}</button>
              </form>
            </>
          )}
        </div>
      </div>
      {adding && <NewConversation onClose={() => setAdding(false)} onPick={(id) => { setAdding(false); navigate(`/messages/${id}`) }} />}
    </>
  )
}
