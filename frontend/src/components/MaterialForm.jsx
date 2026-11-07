import { useState } from 'react'
import { api } from '../api.js'
import { Choice, Modal } from './ui.jsx'
import { t } from '../i18n.js'

export default function MaterialForm({ topicId, material, onSaved, onClose }) {
  const [form, setForm] = useState({
    kind: material?.kind || 'lecture',
    title: material?.title || '',
    content: material?.content || '',
    deadline: material?.deadline?.slice(0, 16) || '',
    max_points: material?.max_points || 10,
    ai_on: material?.ai_on ?? true,
  })
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function save(event) {
    event.preventDefault()
    const body = { ...form, deadline: form.deadline || null, max_points: Number(form.max_points) }
    try {
      if (material) await api(`/materials/${material.id}`, { method: 'PUT', body })
      else await api(`/topics/${topicId}/materials`, { method: 'POST', body })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={material ? t("Редагувати матеріал") : t("Додати матеріал")} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="field">
          <span className="label">{t("Тип")}</span>
          <Choice value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={[['lecture', t("Лекція")], ['lab', t("Лабораторна (оцінювана)")]]} />
        </div>
        <label className="field">
          <span className="label">{t("Назва")}</span>
          <input className="input" value={form.title} onChange={set('title')} placeholder={t("наприклад, Лекція 4. Бінарні дерева")} autoFocus required />
        </label>
        <label className="field">
          <span className="label">{t("Текст")}</span>
          <textarea className="textarea" value={form.content} onChange={set('content')} placeholder={t("Текст лекції або завдання лабораторної")} />
        </label>
        {form.kind === 'lab' && (
          <>
            <label className="field">
              <span className="label">{t("Дедлайн")}</span>
              <input className="input" type="datetime-local" value={form.deadline} onChange={set('deadline')} required />
            </label>
            <label className="field">
              <span className="label">{t("Максимум балів")}</span>
              <input className="input" type="number" min="1" max="100" value={form.max_points} onChange={set('max_points')} required />
            </label>
            <label className="row">
              <input type="checkbox" checked={form.ai_on} onChange={(e) => setForm({ ...form, ai_on: e.target.checked })} />
              {t("Дозволити AI-підказки до цієї лабораторної")}
            </label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{material ? t("Зберегти") : t("Додати матеріал")}</button>
        </div>
      </form>
    </Modal>
  )
}
