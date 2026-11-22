import { useEffect, useState } from 'react'
import { api, timeAgo } from '../api.js'
import { useLive } from '../live.js'
import { Avatar, Empty, Icon, Loading, Modal } from './ui.jsx'
import { t } from '../i18n.js'

function NewAnnouncement({ courseId, onSaved, onClose }) {
  const [form, setForm] = useState({ title: '', body: '', pinned: false })

  async function save(event) {
    event.preventDefault()
    await api(`/courses/${courseId}/announcements`, { method: 'POST', body: form })
    onSaved()
    onClose()
  }

  return (
    <Modal title={t("Нове оголошення")} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">{t("Заголовок")}</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
        </label>
        <label className="field">
          <span className="label">{t("Повідомлення")}</span>
          <textarea className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
        </label>
        <label className="row">
          <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
          {t("Закріпити вгорі")}
        </label>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{t("Опублікувати")}</button>
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
    <Modal title={t("Хто прочитав")} onClose={onClose}>
      {!rows ? <Loading /> : rows.map((row) => (
        <div className="member-row" key={row.id}>
          <Avatar name={row.name} size={28} />
          <span className="grow">{row.name}</span>
          {row.read_at ? <span className="badge ok">{t("Прочитано")} {timeAgo(row.read_at)}</span> : <span className="badge warn">{t("Не прочитано")}</span>}
        </div>
      ))}
    </Modal>
  )
}

export default function Announcements({ courseId, canManage }) {
  const [items, setItems] = useState(null)
  const [adding, setAdding] = useState(false)
  const [readers, setReaders] = useState(null)

  const load = () => api(`/courses/${courseId}/announcements`).then(setItems)
  useEffect(() => { load() }, [courseId])

  useLive((event) => {
    if (event.type === 'announcement' && event.course_id === Number(courseId)) load()
  })

  async function call(path, options) {
    await api(path, options)
    load()
  }

  function remove(item) {
    if (confirm(t("Видалити «{title}»?", { title: item.title }))) call(`/announcements/${item.id}`, { method: 'DELETE' })
  }

  if (!items) return <Loading />
  return (
    <>
      {canManage && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn" onClick={() => setAdding(true)}><Icon name="megaphone" size={16} />{t("Нове оголошення")}</button>
        </div>
      )}
      {items.length === 0 && <Empty icon="megaphone">{t("Оголошень ще немає.")}</Empty>}
      {items.map((item) => (
        <article className={!canManage && !item.read ? 'card announcement unread' : 'card announcement'} key={item.id}>
          <div className="row between">
            <div className="row wrap" style={{ gap: 8 }}>
              {item.pinned && <span className="badge accent"><Icon name="pin" size={12} />{t("Закріплено")}</span>}
              {!canManage && !item.read && <span className="badge warn">{t("Нове")}</span>}
              <h3>{item.title}</h3>
            </div>
            {canManage && (
              <div className="row-actions">
                <button className="icon-btn" title={item.pinned ? t("Відкріпити") : t("Закріпити вгорі")} onClick={() => call(`/announcements/${item.id}/pin`, { method: 'POST' })}><Icon name="pin" size={16} /></button>
                <button className="icon-btn" title={t("Видалити")} onClick={() => remove(item)}><Icon name="trash" size={16} /></button>
              </div>
            )}
          </div>
          <p className="announcement-body">{item.body}</p>
          <div className="row between wrap" style={{ marginTop: 12 }}>
            <span className="row muted small"><Avatar name={item.author} size={22} />{item.author} · {timeAgo(item.created_at)}</span>
            {canManage && <button className="btn secondary sm" onClick={() => setReaders(item)}><Icon name="eye" size={14} />{item.reads - 1} / {item.audience} {t("прочитали")}</button>}
            {!canManage && item.read && <span className="badge ok"><Icon name="check" size={12} />{t("Прочитано")}</span>}
            {!canManage && !item.read && <button className="btn secondary sm" onClick={() => call(`/announcements/${item.id}/read`, { method: 'POST' })}><Icon name="check" size={14} />{t("Підтвердити, що прочитав(ла)")}</button>}
          </div>
        </article>
      ))}
      {adding && <NewAnnouncement courseId={courseId} onSaved={load} onClose={() => setAdding(false)} />}
      {readers && <Readers announcement={readers} onClose={() => setReaders(null)} />}
    </>
  )
}
