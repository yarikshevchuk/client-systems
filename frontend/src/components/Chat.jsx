import { useEffect, useRef, useState } from 'react'
import { api, fmt, getToken } from '../api.js'
import { Avatar, Empty, Icon, Toggle } from './ui.jsx'

export default function Chat({ courseId }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [isQuestion, setIsQuestion] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef(null)

  useEffect(() => {
    let socket
    let closed = false
    api(`/courses/${courseId}/messages`).then((history) => {
      if (closed) return
      setMessages(history)
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${scheme}://${window.location.host}/ws/${courseId}?token=${getToken()}`)
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data)
        setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]))
      }
    })
    return () => {
      closed = true
      if (socket) socket.close()
    }
  }, [courseId])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  async function send(event) {
    event.preventDefault()
    if (!text.trim()) return
    setError('')
    try {
      await api(`/courses/${courseId}/messages`, { method: 'POST', body: { text, is_question: isQuestion } })
      setText('')
      setIsQuestion(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="chat" size={16} /></span>
        <h2>Course Q&amp;A</h2>
      </div>
      <div className="chat">
        {messages.length === 0 && <Empty icon="chat">No messages yet. Ask the first question.</Empty>}
        {messages.map((message) => (
          <div key={message.id} className={message.is_question ? 'msg question' : 'msg'}>
            <Avatar name={message.author} />
            <div className="bubble">
              <div className="head">
                <strong>{message.author}</strong>
                {message.role === 'teacher' && <span className="badge accent">Lecturer</span>}
                {message.is_question ? <span className="badge">Question</span> : null}
                <span>{fmt(message.created_at)}</span>
              </div>
              <div className="body">{message.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={send}>
        <input className="input" placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} />
        <span className="chip">
          <Toggle checked={isQuestion} onChange={setIsQuestion} label="Mark as a question" />
          Question
        </span>
        <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />Send</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
