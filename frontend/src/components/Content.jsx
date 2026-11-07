import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, deadlineStatus, fmtShort } from '../api.js'
import { Empty, Icon, Modal } from './ui.jsx'
import MaterialForm from './MaterialForm.jsx'
import { t } from '../i18n.js'

function TopicForm({ courseId, topic, onSaved, onClose }) {
  const [title, setTitle] = useState(topic ? topic.title : '')

  async function save(event) {
    event.preventDefault()
    if (topic) await api(`/topics/${topic.id}`, { method: 'PUT', body: { title } })
    else await api(`/courses/${courseId}/topics`, { method: 'POST', body: { title } })
    onSaved()
    onClose()
  }

  return (
    <Modal title={topic ? t("Перейменувати тему") : t("Додати тему")} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">{t("Назва")}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("наприклад, Дерева")} autoFocus required />
        </label>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{topic ? t("Зберегти") : t("Додати тему")}</button>
        </div>
      </form>
    </Modal>
  )
}

function Status({ material }) {
  if (material.grade != null) return <span className="status-text ok">{material.grade} / {material.max_points}</span>
  if (material.submission_id) return <span className="status-text accent">{t("Здано")}</span>
  const status = deadlineStatus(material.deadline)
  return <span className={`status-text ${status.tone}`}>{status.text}</span>
}

export default function Content({ data, student, reload }) {
  const [editing, setEditing] = useState(false)
  const [topicForm, setTopicForm] = useState(null)
  const [materialForm, setMaterialForm] = useState(null)
  const topics = data.topics

  async function call(path, options) {
    await api(path, options)
    reload()
  }

  function removeTopic(topic) {
    if (confirm(t("Видалити «{title}» разом з усіма матеріалами, здачами й оцінками?", { title: topic.title }))) call(`/topics/${topic.id}`, { method: 'DELETE' })
  }

  function removeMaterial(material) {
    if (confirm(t("Видалити «{title}» разом зі здачами й оцінками?", { title: material.title }))) call(`/materials/${material.id}`, { method: 'DELETE' })
  }

  const move = (topic, direction) => call(`/topics/${topic.id}/move`, { method: 'POST', body: { direction } })

  return (
    <>
      <div className="section-bar">
        <h2>{t("Матеріали курсу")}</h2>
        {data.can_manage && (
          <button className={editing ? 'btn sm' : 'btn secondary sm'} onClick={() => setEditing(!editing)}>
            <Icon name={editing ? 'check' : 'edit'} size={14} />{editing ? t("Готово") : t("Редагувати вміст")}
          </button>
        )}
      </div>
      {topics.length === 0 && <Empty icon="layers">{t("Тем ще немає.")}</Empty>}

      {topics.map((topic, index) => (
        <section className="topic" key={topic.id}>
          <div className="topic-title">
            <span className="num" style={{ background: 'var(--ink)' }}>{index + 1}</span>
            <h2>{topic.title.replace(/^Тема \d+\.\s*/, '')}</h2>
            {editing && (
              <div className="row-actions push">
                <button className="icon-btn" title={t("Перейменувати")} onClick={() => setTopicForm({ topic })}><Icon name="edit" size={15} /></button>
                {index > 0 && <button className="icon-btn" title={t("Вгору")} onClick={() => move(topic, 'up')}><Icon name="up" size={15} /></button>}
                {index < topics.length - 1 && <button className="icon-btn" title={t("Вниз")} onClick={() => move(topic, 'down')}><Icon name="down" size={15} /></button>}
                <button className="icon-btn" title={t("Видалити")} onClick={() => removeTopic(topic)}><Icon name="trash" size={15} /></button>
              </div>
            )}
          </div>

          {topic.materials.length === 0 && !editing && <p className="muted small">{t("Матеріалів ще немає.")}</p>}
          {topic.materials.map((material) => {
            const lab = material.kind === 'lab'
            return (
              <div className="item" key={material.id}>
                <Link to={`/materials/${material.id}`} className="item-link">
                  <span className={lab ? 'icon-wrap accent' : 'icon-wrap'}><Icon name={lab ? 'file' : 'book'} size={18} /></span>
                  <div className="grow"><strong>{material.title}</strong></div>
                </Link>
                <div className="side">
                  {lab && (student ? <Status material={material} /> : <span className="status-text">{t("до")} {fmtShort(material.deadline)}</span>)}
                  {editing && (
                    <div className="row-actions">
                      <button className="icon-btn" title={t("Редагувати")} onClick={async () => setMaterialForm({ topic, material: await api(`/materials/${material.id}`) })}><Icon name="edit" size={15} /></button>
                      <button className="icon-btn" title={t("Видалити")} onClick={() => removeMaterial(material)}><Icon name="trash" size={15} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {editing && <button className="add-row" onClick={() => setMaterialForm({ topic })}>{t("+ Додати матеріал у цю тему")}</button>}
        </section>
      ))}
      {editing && <button className="add-row" onClick={() => setTopicForm({})}>{t("+ Додати тему")}</button>}

      {topicForm && <TopicForm courseId={data.course.id} topic={topicForm.topic} onSaved={reload} onClose={() => setTopicForm(null)} />}
      {materialForm && <MaterialForm topicId={materialForm.topic.id} material={materialForm.material} onSaved={reload} onClose={() => setMaterialForm(null)} />}
    </>
  )
}
