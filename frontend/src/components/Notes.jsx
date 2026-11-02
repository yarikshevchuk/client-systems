import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Icon } from './ui.jsx'

export default function Notes({ materialId, initial }) {
  const [text, setText] = useState(initial)
  const [state, setState] = useState('')
  const timer = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return undefined
    }
    if (text === initial) return undefined
    setState('Збереження…')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await api(`/materials/${materialId}/note`, { method: 'PUT', body: { text } })
      setState('Збережено')
    }, 700)
    return () => clearTimeout(timer.current)
  }, [text, materialId, initial])

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="edit" size={16} /></span>
        <h2>Мої нотатки</h2>
        <span className="muted small push">{state || 'Бачите лише ви'}</span>
      </div>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишіть власні нотатки до цього матеріалу…" />
    </div>
  )
}
