import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, deadlineStatus, download, fmt, fmtShort, timeAgo } from '../api.js'
import AgentDrawer from '../components/AgentDrawer.jsx'
import AiPanel from '../components/AiPanel.jsx'
import MaterialForm from '../components/MaterialForm.jsx'
import Notes from '../components/Notes.jsx'
import Recordings from '../components/Recordings.jsx'
import { Avatar, Choice, Icon, Loading, Modal } from '../components/ui.jsx'
import { t } from '../i18n.js'

const fileSize = (bytes) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + t(" МБ") : Math.ceil(bytes / 1024) + t(" КБ"))

function Attachments({ material, reload }) {
  async function add(event) {
    const form = new FormData()
    form.append('file', event.target.files[0])
    await api(`/materials/${material.id}/attachments`, { method: 'POST', body: form }).catch((err) => alert(err.message))
    reload()
  }

  async function remove(file) {
    await api(`/attachments/${file.id}`, { method: 'DELETE' })
    reload()
  }

  if (!material.can_manage && material.attachments.length === 0) return null
  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="file" size={16} /></span>
        <h2>{t("Файли")}</h2>
        {material.can_manage && (
          <label className="btn secondary sm push"><Icon name="upload" size={14} />{t("Прикріпити файл")}<input type="file" hidden onChange={add} /></label>
        )}
      </div>
      {material.attachments.length === 0 && <p className="muted small">{t("Файлів ще немає.")}</p>}
      {material.attachments.map((file) => (
        <div className="file-row" key={file.id}>
          <Icon name="file" size={18} />
          <button className="link-btn grow" onClick={() => download(`/attachments/${file.id}/file`, file.filename)}>{file.filename}</button>
          <span className="muted small">{fileSize(file.size)}</span>
          {material.can_manage && <button className="icon-btn" title={t("Видалити файл")} onClick={() => remove(file)}><Icon name="trash" size={16} /></button>}
        </div>
      ))}
    </div>
  )
}

function Upload({ material, onDone }) {
  const [file, setFile] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const sub = material.submission
  const graded = sub && sub.grade !== null

  async function submit(event) {
    event.preventDefault()
    const form = new FormData()
    form.append('file', file)
    form.append('comment', comment)
    try {
      await api(`/materials/${material.id}/submit`, { method: 'POST', body: form })
      onDone()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="upload" size={16} /></span>
        <h2>{t("Ваша робота")}</h2>
        {graded ? <span className="badge ok">{t("Оцінено")}</span> : sub ? <span className="badge accent">{t("Здано")}</span> : <span className="badge">{t("Не здано")}</span>}
      </div>
      {sub && (
        <div className="file-chosen" style={{ marginBottom: 14 }}>
          <span className="icon-wrap"><Icon name="file" size={20} /></span>
          <div className="grow">
            <button className="link-btn" onClick={() => download(`/submissions/${sub.id}/file`, sub.filename)}><strong>{sub.filename}</strong></button>
            <span className="muted small">{t("Здано")} {fmt(sub.submitted_at)}{sub.comment && ` · “${sub.comment}”`}</span>
          </div>
          {graded && <strong style={{ fontSize: '1.3rem' }}>{sub.grade} <span className="muted small">/ {material.max_points}</span></strong>}
        </div>
      )}
      {graded && sub.feedback && (
        <div className="feedback">
          <span className="muted small">{t("Відгук викладача")}</span>
          <p>{sub.feedback}</p>
        </div>
      )}
      {!graded && (
        <form onSubmit={submit} className="stack">
          <input className="input" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0])} required />
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Коментар для викладача (необов'язково)")} />
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <div><button type="submit" className="btn"><Icon name="upload" size={16} />{sub ? t("Здати ще раз") : t("Здати")}</button></div>
        </form>
      )}
    </div>
  )
}

function GradeDialog({ row, material, onSaved, onClose }) {
  const [grade, setGrade] = useState(row.grade ?? '')
  const [feedback, setFeedback] = useState(row.feedback || '')
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    try {
      await api(`/submissions/${row.submission_id}/grade`, { method: 'PUT', body: { grade: Number(grade), feedback } })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={`${t("Оцінювання")}: ${row.name}`} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="file-chosen">
          <span className="icon-wrap"><Icon name="file" size={20} /></span>
          <div className="grow">
            <button type="button" className="link-btn" onClick={() => download(`/submissions/${row.submission_id}/file`, row.filename)}><strong>{row.filename}</strong></button>
            <span className="muted small">{t("Здано")} {fmt(row.submitted_at)}</span>
          </div>
        </div>
        {row.comment && <p className="muted">{t("Коментар студента: «")}{row.comment}»</p>}
        <label className="field">
          <span className="label">{t("Оцінка (макс.")} {material.max_points})</span>
          <input className="input" type="number" min="0" max={material.max_points} value={grade} onChange={(e) => setGrade(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">{t("Відгук")}</span>
          <textarea className="textarea" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={t("Що вдалося, а що варто покращити")} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{t("Зберегти оцінку")}</button>
        </div>
      </form>
    </Modal>
  )
}

function Submissions({ material }) {
  const [rows, setRows] = useState(null)
  const [grading, setGrading] = useState(null)

  const load = () => api(`/materials/${material.id}/submissions`).then(setRows)
  useEffect(() => { load() }, [material.id])

  if (!rows) return <Loading />
  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="users" size={16} /></span>
        <h2>{t("Здані роботи")}</h2>
        <span className="badge">{rows.filter((row) => row.submission_id).length} / {rows.length}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("Студент")}</th><th>{t("Робота")}</th><th>{t("Оцінка")}</th><th /></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.student_id}>
                <td><div className="row"><Avatar name={row.name} size={28} />{row.name}</div></td>
                <td>
                  {row.submission_id ? (
                    <div>
                      <button className="link-btn row" onClick={() => download(`/submissions/${row.submission_id}/file`, row.filename)}><Icon name="download" size={15} />{row.filename}</button>
                      <span className="muted small">{timeAgo(row.submitted_at)}</span>
                    </div>
                  ) : <span className="badge">{t("Не здано")}</span>}
                </td>
                <td>{row.grade !== null ? <span className="badge ok">{row.grade} / {material.max_points}</span> : row.submission_id ? <span className="badge warn">{t("Очікує")}</span> : '—'}</td>
                <td>{row.submission_id && <button className="btn secondary sm" onClick={() => setGrading(row)}>{row.grade !== null ? t("Змінити оцінку") : t("Оцінити")}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grading && <GradeDialog row={grading} material={material} onSaved={load} onClose={() => setGrading(null)} />}
    </div>
  )
}

function AskLecturer({ material }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  async function send(event) {
    event.preventDefault()
    await api(`/courses/${material.course_id}/messages`, { method: 'POST', body: { channel: 'qa', text: `[${material.title}] ${text}` } })
    setText('')
    setSent(true)
  }

  return (
    <form className="card" onSubmit={send}>
      <div className="card-title">
        <span className="icon-wrap"><Icon name="help" size={16} /></span>
        <h2>{t("Питання щодо цієї лабораторної")}</h2>
      </div>
      <div className="row">
        <input className="input" placeholder={t("Запитайте викладача…")} value={text} onChange={(e) => setText(e.target.value)} required />
        <button type="submit" className="btn"><Icon name="send" size={16} />{t("Надіслати")}</button>
      </div>
      {sent && <p className="muted small">{t("Питання надіслано в Q&A курсу.")}</p>}
    </form>
  )
}

function LectureSummary({ material }) {
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSummary(null)
    api(`/materials/${material.id}/summary`).then((data) => data.summary && setSummary(data))
  }, [material.id, material.content])

  async function make() {
    setBusy(true)
    setError('')
    await api(`/materials/${material.id}/summary`, { method: 'POST' }).then(setSummary).catch((err) => setError(err.message))
    setBusy(false)
  }

  return (
    <div className="card ai-card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>{t("AI-конспект")}</h2>
        {material.ai.summaries_on && <button className="btn sm push" onClick={make} disabled={busy}>{busy ? t("Складаємо…") : summary ? t("Оновити") : t("Скласти конспект")}</button>}
      </div>
      {!material.ai.summaries_on && <p className="muted small">{t("Викладач вимкнув AI-конспекти для цього курсу.")}</p>}
      {material.ai.summaries_on && !summary && !error && <p className="muted small">{t("Короткі ключові думки лекції в один клік.")}</p>}
      {error && <p className="error">{error}</p>}
      {summary && (
        <div className="ai-result">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge accent">{t("Згенеровано AI")}</span>
            {summary.demo && <span className="badge">{t("демо-режим")}</span>}
          </div>
          <ul>{summary.summary.split('\n').map((line, index) => <li key={index}>{line.replace(/^[-•*]\s*/, '')}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export default function Material({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [material, setMaterial] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [panel, setPanel] = useState(null)

  const load = () => api(`/materials/${id}`).then(setMaterial).catch((err) => setError(err.message))

  useEffect(() => {
    setMaterial(null)
    setPanel(null)
    load()
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!material) return <Loading />

  const lab = material.kind === 'lab'
  const student = user.role === 'student'
  const status = lab && deadlineStatus(material.deadline)
  const panels = [['notes', t("Нотатки")]]
  if (material.ai_on) panels.push(['ai', t("Питання до AI")])
  if (lab) panels.unshift(['ask', t("Питання")])

  async function remove() {
    if (!confirm(t("Видалити «{title}» разом зі здачами й оцінками?", { title: material.title }))) return
    await api(`/materials/${material.id}`, { method: 'DELETE' })
    navigate(`/courses/${material.course_id}`)
  }

  return (
    <>
      <Link to={`/courses/${material.course_id}`} className="crumb"><Icon name="left" size={16} />{material.course_title} / {material.topic_title}</Link>
      <div className="title-row">
        <div>
          <div className="kicker">{lab ? t("Лабораторна") : t("Лекція")}</div>
          <h1>{material.title}</h1>
          {lab && (
            <p className="meta-line">
              {t("До")} <b>{fmtShort(material.deadline)}</b> · {material.max_points} {t("балів")}
              {!(student && material.submission) && <span className={`status-text ${status.tone}`}> · {status.text}</span>}
            </p>
          )}
        </div>
        {material.can_manage && (
          <div className="row">
            <button className="btn secondary sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} />{t("Редагувати")}</button>
            <button className="btn secondary sm" onClick={remove}><Icon name="trash" size={14} />{t("Видалити")}</button>
          </div>
        )}
      </div>

      <div className={student ? 'material-layout' : ''}>
        <div className="stack">
          {!lab && <LectureSummary material={material} />}
          <div className="card"><p className="reading">{material.content || t("Текст ще не додано.")}</p></div>
          {!lab && <Recordings material={material} user={user} onAppended={load} />}
          <Attachments material={material} reload={load} />
          {lab && material.can_manage && <Submissions material={material} />}
        </div>
        {student && (
          <aside className="material-side">
            {lab && <Upload material={material} onDone={load} />}
            <Choice value={panel} onChange={setPanel} options={panels} />
            {!material.ai_on && <p className="muted small">{t("Викладач вимкнув AI-підказки до цієї лабораторної.")}</p>}
            {panel === 'ask' && <AskLecturer material={material} />}
            {panel === 'notes' && <Notes key={material.id} materialId={material.id} initial={material.note} />}
            {panel === 'ai' && <AiPanel material={material} />}
          </aside>
        )}
      </div>
      {editing && <MaterialForm material={material} onSaved={load} onClose={() => setEditing(false)} />}
      <AgentDrawer courseId={material.course_id} materialId={material.id} />
    </>
  )
}
