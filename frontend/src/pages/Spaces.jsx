import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, plural, timeAgo } from '../api.js'
import { Avatar, colorFor, Empty, Icon, Loading, Modal, useToast } from '../components/ui.jsx'

function NewSpace({ onClose }) {
  const [form, setForm] = useState({ title: '', topic: '', description: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const toast = useToast()
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function create(event) {
    event.preventDefault()
    setError('')
    try {
      const space = await api('/spaces', { method: 'POST', body: form })
      toast('Простір створено')
      navigate(`/spaces/${space.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Новий навчальний простір" onClose={onClose}>
      <form onSubmit={create} className="stack">
        <label className="field">
          <span className="label">Назва</span>
          <input className="input" value={form.title} onChange={set('title')} placeholder="наприклад, Клуб графових алгоритмів" autoFocus required />
        </label>
        <label className="field">
          <span className="label">Тема</span>
          <input className="input" value={form.topic} onChange={set('topic')} placeholder="наприклад, Алгоритми" />
        </label>
        <label className="field">
          <span className="label">Чим ви займатиметеся тут?</span>
          <textarea className="textarea" style={{ minHeight: 80 }} value={form.description} onChange={set('description')} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn">Створити простір</button>
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
    const timer = setTimeout(() => api(`/spaces?q=${encodeURIComponent(query)}`).then(setSpaces), 200)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Навчальні простори</h1>
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Новий простір</button>
      </div>
      <div className="searchbox wide">
        <Icon name="search" size={16} />
        <input placeholder="Пошук за назвою або темою…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!spaces ? <Loading /> : spaces.length === 0 ? <Empty icon="users">Просторів не знайдено.</Empty> : (
        <div className="grid two" style={{ marginTop: 16 }}>
          {spaces.map((space) => (
            <Link to={`/spaces/${space.id}`} className="card course-card" key={space.id} style={{ '--stripe': colorFor(space.id + space.title) }}>
              <h3>{space.title}</h3>
              <div className="meta">
                {space.topic && <span className="badge">{space.topic}</span>}
                <span>{space.members} {plural(space.members, 'учасник', 'учасники', 'учасників')}</span>
              </div>
              <p className="muted small clamp">{space.description || 'Опису ще немає.'}</p>
              <div className="row between" style={{ marginTop: 12 }}>
                <span className="row muted small"><Avatar name={space.owner} size={22} />{space.owner} · {timeAgo(space.created_at)}</span>
                {space.joined ? <span className="badge ok">Ви в просторі</span> : <span className="badge accent">Приєднатися</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {adding && <NewSpace onClose={() => setAdding(false)} />}
    </>
  )
}
