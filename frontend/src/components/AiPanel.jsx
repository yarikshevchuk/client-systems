import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Icon, ProgressBar } from './ui.jsx'

export default function AiPanel({ material }) {
  const [usage, setUsage] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [cards, setCards] = useState(null)
  const [shared, setShared] = useState(false)
  const [error, setError] = useState('')
  const ai = material.ai

  const loadUsage = () => api('/ai/usage').then(setUsage)
  useEffect(() => { loadUsage() }, [])

  async function run(request, setResult) {
    setError('')
    await request().then(setResult).catch((err) => setError(err.message))
    loadUsage()
  }

  function ask(event) {
    event.preventDefault()
    setShared(false)
    run(() => api(`/courses/${material.course_id}/ask`, { method: 'POST', body: { question } }), setAnswer)
  }

  async function askGroup() {
    await api(`/courses/${material.course_id}/messages`, { method: 'POST', body: { channel: 'qa', text: question } })
    setShared(true)
  }

  return (
    <div className="card ai-card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>AI-помічник</h2>
        {usage && <span className="badge push" title="Ваші AI-запити сьогодні">{usage.used} / {usage.limit} сьогодні</span>}
      </div>
      {usage && <ProgressBar percent={(100 * usage.used) / usage.limit} color="var(--ink)" />}
      {error && <p className="error">{error}</p>}

      {material.kind === 'lecture' && (
        <div className="row wrap" style={{ marginTop: 14 }}>
          {ai.flashcards_on
            ? <button className="btn secondary" onClick={() => run(() => api(`/materials/${material.id}/flashcards/generate`, { method: 'POST' }), setCards)}><Icon name="cards" size={16} />Зробити картки</button>
            : <span className="muted small">Викладач вимкнув картки для цього курсу.</span>}
        </div>
      )}
      {cards && (
        <div className="ai-result">
          <span className="badge accent">Згенеровано AI</span> {cards.demo && <span className="badge">демо-режим</span>}
          <p style={{ marginTop: 10 }}>Карток додано: {cards.cards.length}. <Link to="/flashcards" className="link-btn">Відкрити колоду</Link></p>
        </div>
      )}

      {ai.ask_on ? (
        <form onSubmit={ask} className="field" style={{ marginTop: 18 }}>
          <span className="label">Запитайте щось про цей курс</span>
          <div className="row">
            <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="наприклад, Що таке BFS?" required />
            <button type="submit" className="btn">Запитати</button>
          </div>
        </form>
      ) : <p className="muted small" style={{ marginTop: 14 }}>Викладач вимкнув AI-запитання для цього курсу.</p>}

      {answer && (
        <div className="ai-result">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge accent">Згенеровано AI</span>
            {answer.demo && <span className="badge">демо-режим</span>}
            {answer.graded && <span className="badge warn">Оцінювана лабораторна: лише підказки</span>}
          </div>
          <p style={{ marginTop: 10 }}>{answer.answer}</p>
          {answer.sources.length > 0 && (
            <div className="sources">
              <span className="muted small">Джерела:</span>
              {answer.sources.map((source) => <Link className="badge" key={source.id} to={`/materials/${source.id}`}>{source.title}</Link>)}
            </div>
          )}
          {!answer.found && (
            <button className="btn secondary sm" style={{ marginTop: 12 }} onClick={askGroup} disabled={shared}>
              <Icon name={shared ? 'check' : 'help'} size={14} />{shared ? 'Надіслано в Q&A курсу' : 'Запитати в групи'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
