import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import { useLive } from '../live.js'
import { Icon } from './ui.jsx'
import { t } from '../i18n.js'

const ICONS = { grade: 'award', announcement: 'megaphone', reply: 'chat', question: 'help', accepted: 'check', submission: 'upload', reminder: 'clock', message: 'chat' }

export default function Notifications({ count, onRead }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const navigate = useNavigate()

  const load = () => api('/notifications').then((data) => setItems(data.items))

  useLive((event) => {
    if (event.type === 'notification' && open) load()
  })

  function toggle() {
    if (!open) load()
    setOpen(!open)
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    load()
    onRead()
  }

  async function openItem(item) {
    if (!item.read) await api(`/notifications/${item.id}/read`, { method: 'POST' })
    onRead()
    setOpen(false)
    if (item.link) navigate(item.link)
  }

  return (
    <div className="notifications">
      <button className="icon-btn bell" onClick={toggle} aria-label={t("Сповіщення")}>
        <Icon name="bell" size={20} />
        {count > 0 && <span className="dot-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="panel">
          <div className="panel-head">
            <strong>{t("Сповіщення")}</strong>
            <button className="link-btn small" onClick={markAll}>{t("Позначити всі прочитаними")}</button>
          </div>
          <div className="panel-body">
            {items.length === 0 && <p className="muted center-text">{t("Нових сповіщень немає.")}</p>}
            {items.map((item) => (
              <button key={item.id} className={item.read ? 'note' : 'note unread'} onClick={() => openItem(item)}>
                <span className="icon-wrap"><Icon name={ICONS[item.kind] || 'bell'} size={16} /></span>
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
