import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import { Icon } from './ui.jsx'

function Quiz({ quiz }) {
  const [picked, setPicked] = useState({})
  const score = quiz.filter((item, index) => picked[index] === item.answer).length

  return (
    <div className="quiz">
      {quiz.map((item, index) => (
        <div key={index} className="quiz-item">
          <p>{index + 1}. {item.question}</p>
          <div className="quiz-options">
            {item.options.map((option, optionIndex) => {
              const answered = picked[index] !== undefined
              let state = ''
              if (answered && optionIndex === item.answer) state = 'right'
              else if (answered && optionIndex === picked[index]) state = 'wrong'
              return (
                <button key={optionIndex} className={`quiz-option ${state}`} disabled={answered} onClick={() => setPicked({ ...picked, [index]: optionIndex })}>
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {Object.keys(picked).length === quiz.length && <p className="quiz-score">Результат: {score} з {quiz.length}</p>}
    </div>
  )
}

function Message({ message }) {
  return (
    <div className={message.role === 'user' ? 'agent-msg mine' : 'agent-msg'}>
      <div className="agent-bubble">
        <div className="agent-text">{message.text}</div>
        {message.extra?.quiz && <Quiz quiz={message.extra.quiz} />}
        {message.extra?.link && <Link to={message.extra.link} className="btn sm secondary" style={{ marginTop: 8 }}>Відкрити картки</Link>}
        {message.sources?.length > 0 && (
          <div className="agent-sources">
            {message.sources.map((source, index) => <Link key={index} to={`/materials/${source.id}`} className="source-chip">{source.title}</Link>)}
          </div>
        )}
      </div>
      <span className="agent-time">{timeAgo(message.created_at)}</span>
    </div>
  )
}

const SHORTCUTS = [
  ['Конспект цієї лекції', 'Зроби конспект', true],
  ['Тест за матеріалом', 'Перевір мене тестом', true],
  ['Зробити картки', 'Зроби картки', true],
  ['Мої дедлайни', 'Які в мене дедлайни?', false],
  ['Мої оцінки', 'Яка в мене оцінка?', false],
]

export default function AgentDrawer({ courseId, materialId = null }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api(`/courses/${courseId}/agent`).then(setMessages)

  useEffect(() => {
    if (open) load()
  }, [open, courseId])

  async function send(message) {
    if (!message.trim() || busy) return
    setText('')
    setBusy(true)
    setMessages([...messages, { role: 'user', text: message, created_at: new Date() }])
    try {
      await api(`/courses/${courseId}/agent`, { method: 'POST', body: { message, material_id: materialId } })
      await load()
    } catch (err) {
      setMessages([...messages, { role: 'assistant', text: err.message, created_at: new Date() }])
    }
    setBusy(false)
  }

  async function clear() {
    await api(`/courses/${courseId}/agent`, { method: 'DELETE' })
    setMessages([])
  }

  if (!open) return <button className="agent-fab" onClick={() => setOpen(true)}><Icon name="sparkle" size={18} />AI-помічник</button>

  return (
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
        {messages.map((message, index) => <Message key={index} message={message} />)}
        {busy && <div className="agent-msg"><div className="agent-bubble muted">Думаю…</div></div>}
        <div ref={(end) => end?.scrollIntoView({ block: 'nearest' })} />
      </div>
      <div className="chips">
        {SHORTCUTS.filter(([, , needsMaterial]) => materialId || !needsMaterial).map(([label, message]) => (
          <button key={label} className="chip-btn" disabled={busy} onClick={() => send(message)}>{label}</button>
        ))}
      </div>
      <form className="agent-form" onSubmit={(event) => { event.preventDefault(); send(text) }}>
        <input className="input" placeholder="Запитайте про цей курс…" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn" disabled={!text.trim() || busy}><Icon name="send" size={16} /></button>
      </form>
    </aside>
  )
}
