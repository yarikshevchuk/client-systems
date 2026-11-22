import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Icon } from './ui.jsx'
import { t } from '../i18n.js'

export default function Notes({ materialId, initial }) {
  const [text, setText] = useState(initial)
  const [state, setState] = useState(t("Бачите лише ви"))

  useEffect(() => {
    if (text === initial) return
    setState(t("Збереження…"))
    const timer = setTimeout(() => api(`/materials/${materialId}/note`, { method: 'PUT', body: { text } }).then(() => setState(t("Збережено"))), 700)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="edit" size={16} /></span>
        <h2>{t("Мої нотатки")}</h2>
        <span className="muted small push">{state}</span>
      </div>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Напишіть власні нотатки до цього матеріалу…")} />
    </div>
  )
}
