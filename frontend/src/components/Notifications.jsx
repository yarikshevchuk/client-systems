import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import { useLive, useLiveEvents } from '../live.jsx'
import { Icon } from './ui.jsx'

const KIND_ICONS = {
  grade: 'award', announcement: 'megaphone', reply: 'chat', question: 'help', accepted: 'check',
  submission: 'upload', reminder: 'clock', message: 'chat',
}

export default function Notifications() {
  const { counters, refresh } = useLive()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const ref = useRef(null)
  const navigate = useNavigate()

  function load() {
    api('/notifications').then((data) => setItems(data.items))
  }

  useEffect(() => {
    const listener = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [])

  useLiveEvents((event) => {
    if (event.type === 'notification' && open) load()
  })

  function toggle() {
    if (!open) load()
    setOpen(!open)
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    setItems((current) => current.map((item) => ({ ...item, read: true })))
    refresh()
  }

  async function openItem(item) {
    if (!item.read) await api(`/notifications/${item.id}/read`, { method: 'POST' })
    refresh()
    setOpen(false)
    if (item.link) navigate(item.link)
  }

  return (
    <div className="notifications" ref={ref}>
      <button className="icon-btn bell" onClick={toggle} aria-label="Сповіщення">
        <Icon name="bell" size={20} />
        {counters.notifications > 0 && <span className="dot-badge">{counters.notifications > 9 ? '9+' : counters.notifications}</span>}
      </button>
      {open && (
        <div className="panel">
          <div className="panel-head">
            <strong>Сповіщення</strong>
            <button className="link-btn small" onClick={markAll}>Позначити всі прочитаними</button>
          </div>
          <div className="panel-body">
            {items.length === 0 && <p className="muted center-text">Нових сповіщень немає.</p>}
            {items.map((item) => (
              <button key={item.id} className={item.read ? 'note' : 'note unread'} onClick={() => openItem(item)}>
                <span className="icon-wrap"><Icon name={KIND_ICONS[item.kind] || 'bell'} size={16} /></span>
                <span className="grow">
                  <span className="text">{item.text}</span>
                  <span className="muted small">{timeAgo(item.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
