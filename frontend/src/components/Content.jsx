import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtShort, relative } from '../api.js'
import { Confirm, Empty, Icon, Modal, useToast } from './ui.jsx'
import MaterialForm from './MaterialForm.jsx'

function TopicForm({ courseId, topic, onSaved, onClose }) {
  const [title, setTitle] = useState(topic ? topic.title : '')
  const [error, setError] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      if (topic) await api(`/topics/${topic.id}`, { method: 'PUT', body: { title } })
      else await api(`/courses/${courseId}/topics`, { method: 'POST', body: { title } })
      toast(topic ? 'Тему перейменовано' : 'Тему додано')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={topic ? 'Перейменувати тему' : 'Додати тему'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">Назва</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="наприклад, Дерева" autoFocus required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Скасувати</button>
          <button type="submit" className="btn">{topic ? 'Зберегти' : 'Додати тему'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Status({ material }) {
  if (material.kind !== 'lab') return null
  if (material.grade !== null && material.grade !== undefined) return <span className="status-text ok">{material.grade} / {material.max_points}</span>
  if (material.submission_id) return <span className="status-text accent">Здано</span>
  const due = relative(material.deadline)
  return due ? <span className={`status-text ${due.tone === 'ok' ? '' : due.tone}`}>{due.text}</span> : null
}

export default function Content({ data, canManage, student, reload }) {
  const [dialog, setDialog] = useState(null)
  const [editing, setEditing] = useState(false)
  const toast = useToast()

  async function call(path, options, message) {
    try {
      await api(path, options)
      if (message) toast(message)
      reload()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  return (
    <>
      <div className="section-bar">
        <h2>Матеріали курсу</h2>
        {canManage && (
          <button className={editing ? 'btn sm' : 'btn secondary sm'} onClick={() => setEditing(!editing)}>
            <Icon name={editing ? 'check' : 'edit'} size={14} />{editing ? 'Готово' : 'Редагувати вміст'}
          </button>
        )}
      </div>
      {data.topics.length === 0 && <Empty icon="layers">Тем ще немає.{canManage ? ' Натисніть «Редагувати вміст» і додайте першу.' : ''}</Empty>}
      {data.topics.map((topic, index) => (
        <section className="topic" key={topic.id} style={index === 0 ? { marginTop: 8 } : undefined}>
          <div className="topic-title">
            <span className="num" style={{ background: 'var(--ink)' }}>{index + 1}</span>
            <h2>{topic.title.replace(/^(Topic|Тема) \d+\.\s*/, '')}</h2>
            {editing && (
              <div className="row-actions push">
                <button className="icon-btn" title="Перейменувати тему" onClick={() => setDialog({ type: 'topic', topic })}><Icon name="edit" size={15} /></button>
                {index > 0 && <button className="icon-btn" title="Вгору" onClick={() => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction: 'up' } })}><Icon name="up" size={15} /></button>}
                {index < data.topics.length - 1 && <button className="icon-btn" title="Вниз" onClick={() => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction: 'down' } })}><Icon name="down" size={15} /></button>}
                <button className="icon-btn" title="Видалити тему" onClick={() => setDialog({ type: 'delete-topic', topic })}><Icon name="trash" size={15} /></button>
              </div>
            )}
          </div>
          {topic.materials.length === 0 && !editing && <p className="muted small">Матеріалів ще немає.</p>}
          {topic.materials.map((material) => (
            <div className="item" key={material.id}>
              <Link to={`/materials/${material.id}`} className="item-link">
                <span className={material.kind === 'lab' ? 'icon-wrap accent' : 'icon-wrap'}>
                  <Icon name={material.kind === 'lab' ? 'file' : 'book'} size={18} />
                </span>
                <div className="grow">
                  <strong>{material.title}</strong>
                </div>
              </Link>
              <div className="side">
                {student ? <Status material={material} /> : material.kind === 'lab' && <span className="status-text">до {fmtShort(material.deadline)}</span>}
                {editing && (
                  <div className="row-actions">
                    <button className="icon-btn" title="Редагувати" onClick={async () => setDialog({ type: 'material', topic, material: await api(`/materials/${material.id}`) })}><Icon name="edit" size={15} /></button>
                    <button className="icon-btn" title="Видалити" onClick={() => setDialog({ type: 'delete-material', material })}><Icon name="trash" size={15} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {editing && <button className="add-row" onClick={() => setDialog({ type: 'material', topic })}>+ Додати матеріал у цю тему</button>}
        </section>
      ))}
      {editing && <button className="add-row" style={{ marginTop: 20 }} onClick={() => setDialog({ type: 'topic' })}>+ Додати тему</button>}

      {dialog && dialog.type === 'topic' && <TopicForm courseId={data.course.id} topic={dialog.topic} onSaved={reload} onClose={() => setDialog(null)} />}
      {dialog && dialog.type === 'material' && (
        <MaterialForm topicId={dialog.topic.id} material={dialog.material || null} onSaved={reload} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog.type === 'delete-topic' && (
        <Confirm title="Видалити тему" text={`Видалити «${dialog.topic.title}» разом з усіма матеріалами, здачами й оцінками? Цю дію не можна скасувати.`} onConfirm={() => call(`/topics/${dialog.topic.id}`, { method: 'DELETE' }, 'Тему видалено')} onClose={() => setDialog(null)} />
      )}
      {dialog && dialog.type === 'delete-material' && (
        <Confirm title="Видалити матеріал" text={`Видалити «${dialog.material.title}» разом зі здачами й оцінками? Цю дію не можна скасувати.`} onConfirm={() => call(`/materials/${dialog.material.id}`, { method: 'DELETE' }, 'Матеріал видалено')} onClose={() => setDialog(null)} />
      )}
    </>
  )
}
