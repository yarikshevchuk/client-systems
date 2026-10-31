import { useState } from 'react'
import { api } from '../api.js'

export default function AiPanel({ material, ai }) {
  const [summary, setSummary] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState('')
  const [shared, setShared] = useState(false)

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
  }

  return (
    <div className="card">
      <h2>AI assistant</h2>
      {error && <p className="error">{error}</p>}
      {material.kind === 'lecture' && (
        <>
          {ai.summaries_on ? (
            <button onClick={loadSummary}>{summary ? 'Reload AI summary' : 'AI summary'}</button>
          ) : (
            <p className="muted">AI summaries are turned off for this course.</p>
          )}
          {summary && (
            <div className="summary">
              <span className="tag">AI-generated{summary.demo ? ' · demo mode' : ''}{summary.cached ? ' · saved' : ''}</span>
              <h3>Key points</h3>
              <ul>
                {summary.summary.split('\n').map((line, index) => (
                  <li key={index}>{line.replace(/^[-•*]\s*/, '')}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {ai.ask_on ? (
        <form onSubmit={ask}>
          <label>
            Ask a question about this course
            <input value={question} onChange={(e) => setQuestion(e.target.value)} required />
          </label>
          <button type="submit">Go</button>
        </form>
      ) : (
        <p className="muted">The AI question box is turned off for this course.</p>
      )}
      {answer && (
        <div className="summary">
          <span className="tag">AI-generated{answer.demo ? ' · demo mode' : ''}</span>
          <p>{answer.answer}</p>
          {answer.sources.length > 0 && <p className="muted">Sources: {answer.sources.map((s) => s.title).join('; ')}</p>}
          {!answer.found && (
            <>
              <button className="secondary" onClick={askGroup} disabled={shared}>
                {shared ? 'Sent to Course Q&A' : 'Ask the group'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
