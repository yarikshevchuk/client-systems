import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmt, relative } from '../api.js'
import { colorFor, Confirm, Empty, Icon, Menu, Modal, useToast } from './ui.jsx'
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
  if (material.grade !== null && material.grade !== undefined) return <span className="badge ok">{material.grade} / {material.max_points}</span>
  if (material.submission_id) return <span className="badge accent">Здано</span>
  const due = relative(material.deadline)
  return due ? <span className={`badge ${due.tone}`}>{due.text}</span> : null
}

export default function Content({ data, canManage, student, reload }) {
  const [dialog, setDialog] = useState(null)
  const toast = useToast()
  const color = colorFor(data.course.id)

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
      {canManage && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button className="btn secondary" onClick={() => setDialog({ type: 'topic' })}><Icon name="plus" size={16} />Додати тему</button>
        </div>
      )}
      {data.topics.length === 0 && <Empty icon="layers">Тем ще немає.{canManage ? ' Додайте першу.' : ''}</Empty>}
      {data.topics.map((topic, index) => (
        <section className="topic" key={topic.id} style={index === 0 ? { marginTop: 0 } : undefined}>
          <div className="topic-title">
            <span className="num" style={{ background: color }}>{index + 1}</span>
            <h2>{topic.title.replace(/^(Topic|Тема) \d+\.\s*/, '')}</h2>
            {canManage && (
              <div className="push">
                <Menu
                  label="Дії з темою"
                  items={[
                    { label: 'Додати матеріал', onClick: () => setDialog({ type: 'material', topic }) },
                    { label: 'Перейменувати тему', onClick: () => setDialog({ type: 'topic', topic }) },
                    index > 0 && { label: 'Перемістити вгору', onClick: () => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction: 'up' } }) },
                    index < data.topics.length - 1 && { label: 'Перемістити вниз', onClick: () => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction: 'down' } }) },
                    { label: 'Видалити тему', danger: true, onClick: () => setDialog({ type: 'delete-topic', topic }) },
                  ]}
                />
              </div>
            )}
          </div>
          {topic.materials.length === 0 && <p className="muted small">Матеріалів ще немає.</p>}
          {topic.materials.map((material) => (
            <div className="item" key={material.id}>
              <Link to={`/materials/${material.id}`} className="item-link">
                <span className={material.kind === 'lab' ? 'icon-wrap accent' : 'icon-wrap'}>
                  <Icon name={material.kind === 'lab' ? 'file' : 'book'} size={20} />
                </span>
                <div className="grow">
                  <strong>{material.title}</strong>
                  <span className="muted small">
                    {material.kind === 'lab' ? `Лабораторна · до ${fmt(material.deadline)} · ${material.max_points} балів` : 'Лекція'}
                  </span>
                </div>
              </Link>
              <div className="side">
                {student && <Status material={material} />}
                {canManage && (
                  <Menu
                    label="Дії з матеріалом"
                    items={[
                      { label: 'Редагувати', onClick: async () => setDialog({ type: 'material', topic, material: await api(`/materials/${material.id}`) }) },
                      { label: 'Видалити', danger: true, onClick: () => setDialog({ type: 'delete-material', material }) },
                    ]}
                  />
                )}
              </div>
            </div>
          ))}
        </section>
      ))}

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
