import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Icon, ProgressBar, useToast } from './ui.jsx'

export default function AiPanel({ material, ai }) {
  const [summary, setSummary] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [cards, setCards] = useState(null)
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState('')
  const [shared, setShared] = useState(false)
  const toast = useToast()
  const lecture = material.kind === 'lecture'

  const refreshUsage = () => api('/ai/usage').then(setUsage)
  useEffect(() => {
    refreshUsage()
  }, [])

  async function run(action) {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
    refreshUsage()
  }

  const loadSummary = () => run(async () => setSummary(await api(`/materials/${material.id}/summary`, { method: 'POST' })))
  const makeCards = () => run(async () => {
    const data = await api(`/materials/${material.id}/flashcards/generate`, { method: 'POST' })
    setCards(data)
    toast(`${data.cards.length} flashcards added to your deck`)
  })

  async function ask(event) {
    event.preventDefault()
    setShared(false)
    run(async () => setAnswer(await api(`/courses/${material.course_id}/ask`, { method: 'POST', body: { question } })))
  }

  async function askGroup() {
    await api(`/courses/${material.course_id}/messages`, { method: 'POST', body: { channel: 'qa', text: question } })
    setShared(true)
    toast('Question sent to the course Q&A')
  }

  return (
    <div className="card ai-card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="sparkle" size={16} /></span>
        <h2>AI assistant</h2>
        {usage && <span className="badge push" title="Your AI requests today">{usage.used} / {usage.limit} today</span>}
      </div>
      {usage && <ProgressBar percent={(100 * usage.used) / usage.limit} color="var(--ink)" />}
      {error && <p className="error">{error}</p>}

      {lecture && (
        <div className="row wrap" style={{ marginTop: 14 }}>
          {ai.summaries_on ? (
            <button className="btn secondary" onClick={loadSummary}><Icon name="sparkle" size={16} />{summary ? 'Reload summary' : 'Summarise this lecture'}</button>
          ) : <span className="muted small">Summaries are turned off for this course.</span>}
          {ai.flashcards_on ? (
            <button className="btn secondary" onClick={makeCards}><Icon name="cards" size={16} />Make flashcards</button>
          ) : <span className="muted small">Flashcards are turned off for this course.</span>}
        </div>
      )}

      {summary && (
        <div className="ai-result">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge accent">AI-generated</span>
            {summary.demo && <span className="badge">demo mode</span>}
            {summary.cached && <span className="badge">saved</span>}
          </div>
          <h3 style={{ marginTop: 10 }}>Key points</h3>
          <ul>{summary.summary.split('\n').map((line, index) => <li key={index}>{line.replace(/^[-•*]\s*/, '')}</li>)}</ul>
        </div>
      )}

      {cards && (
        <div className="ai-result">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="badge accent">AI-generated</span>
            {cards.demo && <span className="badge">demo mode</span>}
          </div>
          <p style={{ marginTop: 10 }}>{cards.cards.length} cards were added. <Link to="/flashcards" className="link-btn">Open your deck</Link></p>
        </div>
      )}

      {ai.ask_on ? (
        <form onSubmit={ask} style={{ marginTop: 18 }}>
          <label className="field">
            <span className="label">Ask a question about this course</span>
            <div className="row">
              <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What is BFS?" required />
              <button type="submit" className="btn">Ask</button>
            </div>
          </label>
        </form>
      ) : <p className="muted small" style={{ marginTop: 14 }}>The AI question box is turned off for this course.</p>}

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
                <Link className="badge" key={source.id} to={`/materials/${source.id}`}>{source.title}</Link>
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
