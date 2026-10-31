import { useEffect, useRef, useState } from 'react'
import { api, fmt, getToken } from '../api.js'

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
      <h2>Course Q&amp;A</h2>
      <div className="chat">
        {messages.map((message) => (
          <div key={message.id} className={message.is_question ? 'message question' : 'message'}>
            <div className="muted">
              {message.author}
              {message.role === 'teacher' ? ' (lecturer)' : ''} · {fmt(message.created_at)}
              {message.is_question ? ' · question' : ''}
            </div>
            <div>{message.text}</div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send}>
        <input placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={isQuestion} onChange={(e) => setIsQuestion(e.target.checked)} />
          This is a question
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
