import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import { useAgent } from '../agent.jsx'
import { Icon } from './ui.jsx'

function Quiz({ quiz }) {
  const [picked, setPicked] = useState({})
  const done = Object.keys(picked).length === quiz.length
  const score = quiz.filter((item, index) => picked[index] === item.answer).length

  return (
    <div className="quiz">
      {quiz.map((item, index) => (
        <div key={index} className="quiz-item">
          <p>{index + 1}. {item.question}</p>
          <div className="quiz-options">
            {item.options.map((option, optionIndex) => {
              const chosen = picked[index]
              const state = chosen === undefined ? '' : optionIndex === item.answer ? 'right' : optionIndex === chosen ? 'wrong' : ''
              return (
                <button key={optionIndex} className={`quiz-option ${state}`} disabled={chosen !== undefined} onClick={() => setPicked({ ...picked, [index]: optionIndex })}>
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {done && <p className="quiz-score">Результат: {score} з {quiz.length}</p>}
    </div>
  )
}

function Message({ message }) {
  const mine = message.role === 'user'
  return (
    <div className={mine ? 'agent-msg mine' : 'agent-msg'}>
      <div className="agent-bubble">
        <div className="agent-text">{message.text}</div>
        {message.extra && message.extra.quiz && <Quiz quiz={message.extra.quiz} />}
        {message.extra && message.extra.link && <Link to={message.extra.link} className="btn sm secondary" style={{ marginTop: 8 }}>Відкрити картки</Link>}
        {message.sources && message.sources.length > 0 && (
          <div className="agent-sources">
            {message.sources.map((source, index) => <Link key={`${source.id}-${index}`} to={`/materials/${source.id}`} className="source-chip">{source.title}</Link>)}
          </div>
        )}
      </div>
      <span className="agent-time">{timeAgo(message.created_at)}</span>
    </div>
  )
}

export default function AgentDrawer() {
  const { ctx, open, setOpen } = useAgent()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef(null)
  const courseId = ctx && ctx.courseId

  useEffect(() => {
    setMessages([])
    if (courseId && open) api(`/courses/${courseId}/agent`).then(setMessages)
  }, [courseId, open])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy, open])

  if (!ctx) return null

  async function send(message) {
    const value = (message ?? text).trim()
    if (!value || busy) return
    setText('')
    setBusy(true)
    setMessages((current) => [...current, { id: 'tmp', role: 'user', text: value, sources: [], extra: {}, created_at: new Date().toISOString() }])
    try {
      const reply = await api(`/courses/${courseId}/agent`, { method: 'POST', body: { message: value, material_id: ctx.materialId } })
      setMessages(await api(`/courses/${courseId}/agent`))
      return reply
    } catch (err) {
      setMessages((current) => [...current, { id: 'err', role: 'assistant', text: err.message, sources: [], extra: {}, created_at: new Date().toISOString() }])
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    await api(`/courses/${courseId}/agent`, { method: 'DELETE' })
    setMessages([])
  }

  const chips = [
    ctx.materialId && ['Конспект цієї лекції', 'Зроби конспект'],
    ctx.materialId && ['Тест за матеріалом', 'Перевір мене тестом'],
    ctx.materialId && ['Зробити картки', 'Зроби картки'],
    ['Мої дедлайни', 'Які в мене дедлайни?'],
    ['Мої оцінки', 'Яка в мене оцінка?'],
  ].filter(Boolean)

  return (
    <>
      {!open && <button className="agent-fab" onClick={() => setOpen(true)}><Icon name="sparkle" size={18} />AI-помічник</button>}
      {open && (
        <aside className="agent-drawer" aria-label="AI-помічник">
          <header className="agent-head">
            <div>
              <strong>AI-помічник</strong>
              <div className="muted small">Відповідає за матеріалами курсу, записами лекцій і вашими даними</div>
            </div>
            <div className="row-actions">
              {messages.length > 0 && <button className="icon-btn" title="Очистити розмову" onClick={clear}><Icon name="trash" size={16} /></button>}
              <button className="icon-btn" title="Закрити" onClick={() => setOpen(false)}><Icon name="x" size={18} /></button>
            </div>
          </header>
          <div className="agent-body">
            {messages.length === 0 && (
              <div className="agent-empty">
                <p><b>Чим допомогти?</b></p>
                <p className="muted">Спитайте про лекцію, попросіть конспект, тест або картки. Я також знаю ваші дедлайни й оцінки.</p>
              </div>
            )}
            {messages.map((message, index) => <Message key={`${message.id}-${index}`} message={message} />)}
            {busy && <div className="agent-msg"><div className="agent-bubble muted">Думаю…</div></div>}
            <div ref={bottom} />
          </div>
          <div className="chips">
            {chips.map(([label, message]) => <button key={label} className="chip-btn" disabled={busy} onClick={() => send(message)}>{label}</button>)}
          </div>
          <form className="agent-form" onSubmit={(event) => { event.preventDefault(); send() }}>
            <input className="input" placeholder="Запитайте про цей курс…" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="btn" disabled={!text.trim() || busy}><Icon name="send" size={16} /></button>
          </form>
        </aside>
      )}
    </>
  )
}
