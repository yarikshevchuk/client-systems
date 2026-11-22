import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, plural, timeAgo } from '../api.js'
import { Avatar, colorFor, Empty, Icon, Loading, Modal } from '../components/ui.jsx'
import { t } from '../i18n.js'

function NewSpace({ onClose }) {
  const [form, setForm] = useState({ title: '', topic: '', description: '' })
  const navigate = useNavigate()
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function create(event) {
    event.preventDefault()
    const space = await api('/spaces', { method: 'POST', body: form })
    navigate(`/spaces/${space.id}`)
  }

  return (
    <Modal title={t("Новий навчальний простір")} onClose={onClose}>
      <form onSubmit={create} className="stack">
        <label className="field">
          <span className="label">{t("Назва")}</span>
          <input className="input" value={form.title} onChange={set('title')} placeholder={t("наприклад, Клуб графових алгоритмів")} autoFocus required />
        </label>
        <label className="field">
          <span className="label">{t("Тема")}</span>
          <input className="input" value={form.topic} onChange={set('topic')} placeholder={t("наприклад, Алгоритми")} />
        </label>
        <label className="field">
          <span className="label">{t("Чим ви займатиметеся тут?")}</span>
          <textarea className="textarea" value={form.description} onChange={set('description')} />
        </label>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{t("Створити простір")}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Spaces() {
  const [spaces, setSpaces] = useState(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api(`/spaces?q=${encodeURIComponent(query)}`).then(setSpaces)
  }, [query])

  return (
    <>
      <div className="page-head">
        <h1>{t("Навчальні простори")}</h1>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{t("Новий простір")}</button>
      </div>
      <div className="searchbox wide">
        <Icon name="search" size={16} />
        <input placeholder={t("Пошук за назвою або темою…")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!spaces && <Loading />}
      {spaces?.length === 0 && <Empty icon="users">{t("Просторів не знайдено.")}</Empty>}
      <div className="grid two" style={{ marginTop: 16 }}>
        {spaces?.map((space) => (
          <Link to={`/spaces/${space.id}`} className="card course-card" key={space.id} style={{ '--stripe': colorFor(space.id + space.title) }}>
            <h3>{space.title}</h3>
            <div className="meta">
              {space.topic && <span className="badge">{space.topic}</span>}
              <span>{space.members} {plural(space.members, t("учасник"), t("учасники"), t("учасників"))}</span>
            </div>
            <p className="muted small clamp">{space.description || t("Опису ще немає.")}</p>
            <div className="row between" style={{ marginTop: 12 }}>
              <span className="row muted small"><Avatar name={space.owner} size={22} />{space.owner} · {timeAgo(space.created_at)}</span>
              {space.joined ? <span className="badge ok">{t("Ви в просторі")}</span> : <span className="badge accent">{t("Приєднатися")}</span>}
            </div>
          </Link>
        ))}
      </div>
      {adding && <NewSpace onClose={() => setAdding(false)} />}
    </>
  )
}
