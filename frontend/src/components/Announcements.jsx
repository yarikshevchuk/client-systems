import { useEffect, useState } from 'react'
import { api, timeAgo } from '../api.js'
import { useLiveEvents } from '../live.jsx'
import { Avatar, Confirm, Empty, Icon, Loading, Menu, Modal, Toggle, useToast } from './ui.jsx'

function NewAnnouncement({ courseId, onSaved, onClose }) {
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [error, setError] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      await api(`/courses/${courseId}/announcements`, { method: 'POST', body: form })
      toast('Announcement published')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="New announcement" onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
        </label>
        <label className="field">
          <span className="label">Message</span>
          <textarea className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </label>
        <div className="row between">
          <span>Pin to the top</span>
          <Toggle label="Pin to the top" checked={form.pinned} onChange={(pinned) => setForm({ ...form, pinned })} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Publish</button>
        </div>
      </form>
    </Modal>
  )
}

function Readers({ announcement, onClose }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    api(`/announcements/${announcement.id}/readers`).then(setRows)
  }, [announcement.id])

  return (
    <Modal title="Who has read it" onClose={onClose}>
      {!rows ? <Loading /> : rows.map((row) => (
        <div className="row between" key={row.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <div className="row"><Avatar name={row.name} size={28} />{row.name}</div>
          {row.read_at ? <span className="badge ok">Read {timeAgo(row.read_at)}</span> : <span className="badge warn">Not read</span>}
        </div>
      ))}
    </Modal>
  )
}

export default function Announcements({ courseId, canManage }) {
  const [items, setItems] = useState(null)
  const [dialog, setDialog] = useState(null)
  const toast = useToast()

  function load() {
    api(`/courses/${courseId}/announcements`).then(setItems)
  }

  useEffect(load, [courseId])
  useLiveEvents((event) => {
    if (event.type === 'announcement' && event.course_id === Number(courseId)) load()
  })

  async function markRead(item) {
    await api(`/announcements/${item.id}/read`, { method: 'POST' })
    load()
  }

  async function act(path, options, message) {
    try {
      await api(path, options)
      if (message) toast(message)
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  if (!items) return <Loading />
  return (
    <>
      {canManage && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn" onClick={() => setDialog({ type: 'new' })}><Icon name="megaphone" size={16} />New announcement</button>
        </div>
      )}
      {items.length === 0 && <Empty icon="megaphone">No announcements yet.</Empty>}
      {items.map((item) => (
        <article className={!canManage && !item.read ? 'card announcement unread' : 'card announcement'} key={item.id}>
          <div className="row between">
            <div className="row wrap" style={{ gap: 8 }}>
              {item.pinned && <span className="badge accent"><Icon name="pin" size={12} />Pinned</span>}
              {!canManage && !item.read && <span className="badge warn">New</span>}
              <h3>{item.title}</h3>
            </div>
            {canManage && (
              <Menu
                items={[
                  { label: item.pinned ? 'Unpin' : 'Pin to the top', onClick: () => act(`/announcements/${item.id}/pin`, { method: 'POST' }) },
                  { label: 'Delete', danger: true, onClick: () => setDialog({ type: 'delete', item }) },
                ]}
              />
            )}
          </div>
          <p className="announcement-body">{item.body}</p>
          <div className="row between wrap" style={{ marginTop: 12 }}>
            <span className="row muted small"><Avatar name={item.author} size={22} />{item.author} · {timeAgo(item.created_at)}</span>
            {canManage ? (
              <button className="btn secondary sm" onClick={() => setDialog({ type: 'readers', item })}>
                <Icon name="eye" size={14} />{item.reads - 1} / {item.audience} read
              </button>
            ) : item.read ? (
              <span className="badge ok"><Icon name="check" size={12} />Read</span>
            ) : (
              <button className="btn secondary sm" onClick={() => markRead(item)}><Icon name="check" size={14} />Confirm that I read it</button>
            )}
          </div>
        </article>
      ))}
      {dialog && dialog.type === 'new' && <NewAnnouncement courseId={courseId} onSaved={load} onClose={() => setDialog(null)} />}
      {dialog && dialog.type === 'readers' && <Readers announcement={dialog.item} onClose={() => setDialog(null)} />}
      {dialog && dialog.type === 'delete' && (
        <Confirm title="Delete announcement" text={`Delete “${dialog.item.title}”?`} onConfirm={() => act(`/announcements/${dialog.item.id}`, { method: 'DELETE' }, 'Announcement deleted')} onClose={() => setDialog(null)} />
      )}
    </>
  )
}
