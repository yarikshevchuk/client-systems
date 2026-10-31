import { useState } from 'react'
import { api } from '../api.js'
import { Icon, useToast } from './ui.jsx'

export default function AiPanel({ material, ai }) {
  const [summary, setSummary] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState('')
  const [shared, setShared] = useState(false)
  const toast = useToast()

  async function loadSummary() {
    setError('')
    try {
      setSummary(await api(`/materials/${material.id}/summary`, { method: 'POST' }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function ask(event) {
    event.preventDefault()
    setError('')
    setShared(false)
    try {
      setAnswer(await api(`/courses/${material.course_id}/ask`, { method: 'POST', body: { question } }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function askGroup() {
    await api(`/courses/${material.course_id}/messages`, { method: 'POST', body: { text: question, is_question: true } })
    setShared(true)
    toast('Question sent to Course Q&A')
  }

  return (
    <div className="card ai-card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>AI assistant</h2>
      </div>
      {error && <p className="error" style={{ margin: '0 0 12px' }}>{error}</p>}

      {material.kind === 'lecture' &&
        (ai.summaries_on ? (
          <button className="btn secondary" onClick={loadSummary}><Icon name="sparkle" size={16} />{summary ? 'Reload AI summary' : 'AI summary'}</button>
        ) : (
          <p className="muted small">AI summaries are turned off for this course.</p>
        ))}
      {summary && (
        <div className="ai-result">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge accent">AI-generated</span>
            {summary.demo && <span className="badge">demo mode</span>}
            {summary.cached && <span className="badge">saved</span>}
          </div>
          <h3 style={{ marginTop: 10 }}>Key points</h3>
          <ul>
            {summary.summary.split('\n').map((line, index) => (
              <li key={index}>{line.replace(/^[-•*]\s*/, '')}</li>
            ))}
          </ul>
        </div>
      )}

      {ai.ask_on ? (
        <form onSubmit={ask} style={{ marginTop: material.kind === 'lecture' ? 20 : 0 }}>
          <label className="field">
            <span className="label">Ask a question about this course</span>
            <div className="row">
              <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What is BFS?" required />
              <button type="submit" className="btn">Go</button>
            </div>
          </label>
        </form>
      ) : (
        <p className="muted small" style={{ marginTop: 12 }}>The AI question box is turned off for this course.</p>
      )}

      {answer && (
        <div className="ai-result">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge accent">AI-generated</span>
            {answer.demo && <span className="badge">demo mode</span>}
            {answer.graded && <span className="badge warn">Graded lab: hints only</span>}
          </div>
          <p style={{ marginTop: 10 }}>{answer.answer}</p>
          {answer.sources.length > 0 && (
            <div className="sources">
              <span className="muted small">Sources:</span>
              {answer.sources.map((source) => (
                <span className="badge" key={source.id}>{source.title}</span>
              ))}
            </div>
          )}
          {!answer.found && (
            <div style={{ marginTop: 12 }}>
              <button className="btn secondary sm" onClick={askGroup} disabled={shared}>
                <Icon name={shared ? 'check' : 'help'} size={14} />
                {shared ? 'Sent to Course Q&A' : 'Ask the group'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
