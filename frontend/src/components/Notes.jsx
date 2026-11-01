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
    setState('Saving…')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await api(`/materials/${materialId}/note`, { method: 'PUT', body: { text } })
      setState('Saved')
    }, 700)
    return () => clearTimeout(timer.current)
  }, [text, materialId])

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="edit" size={16} /></span>
        <h2>My notes</h2>
        <span className="muted small push">{state || 'Only you can see this'}</span>
      </div>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your own notes about this material…" />
    </div>
  )
}
