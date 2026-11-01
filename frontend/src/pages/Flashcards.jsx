import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, timeUntil } from '../api.js'
import { Empty, Icon, Loading, Modal, ProgressBar, useToast } from '../components/ui.jsx'

function NewCard({ onClose, onSaved }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const toast = useToast()

  async function save(event) {
    event.preventDefault()
    await api('/flashcards', { method: 'POST', body: { front, back } })
    toast('Card added')
    onSaved()
    onClose()
  }

  return (
    <Modal title="New flashcard" onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">Question</span>
          <textarea className="textarea" style={{ minHeight: 70 }} value={front} onChange={(e) => setFront(e.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span className="label">Answer</span>
          <textarea className="textarea" style={{ minHeight: 70 }} value={back} onChange={(e) => setBack(e.target.value)} required />
        </label>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn">Add card</button>
        </div>
      </form>
    </Modal>
  )
}

function Review({ cards, onDone }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const [right, setRight] = useState(0)
  const card = cards[index]

  async function answer(correct) {
    await api(`/flashcards/${card.id}/review`, { method: 'POST', body: { correct } })
    if (correct) setRight(right + 1)
    setShown(false)
    setIndex(index + 1)
  }

  if (!card) {
    return (
      <div className="card center-card">
        <span className="icon-wrap big"><Icon name="check" size={28} /></span>
        <h2>Session complete</h2>
        <p className="muted">You answered {right} of {cards.length} correctly.</p>
        <button className="btn" onClick={onDone}>Back to the deck</button>
      </div>
    )
  }

  return (
    <div className="card review">
      <div className="row between">
        <span className="muted small">Card {index + 1} of {cards.length}</span>
        <button className="link-btn small" onClick={onDone}>End session</button>
      </div>
      <ProgressBar percent={(100 * index) / cards.length} color="var(--ink)" />
      <div className="flash">
        <p className="front">{card.front}</p>
        {shown && <p className="back">{card.back}</p>}
      </div>
      {!shown ? (
        <button className="btn block" onClick={() => setShown(true)}>Show answer</button>
      ) : (
        <div className="row">
          <button className="btn secondary block" onClick={() => answer(false)}>I did not know</button>
          <button className="btn block" onClick={() => answer(true)}>I knew it</button>
        </div>
      )}
    </div>
  )
}

export default function Flashcards() {
  const [data, setData] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [adding, setAdding] = useState(false)

  function load() {
    api('/flashcards').then(setData)
  }

  useEffect(load, [])

  if (!data) return <Loading />
  const due = data.cards.filter((card) => card.is_due)

  if (reviewing) {
    return (
      <>
        <div className="page-head"><div><h1>Review</h1></div></div>
        <Review cards={reviewing} onDone={() => { setReviewing(null); load() }} />
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Flashcards</h1>
          <p>Cards you answer correctly come back later, the ones you miss come back sooner.</p>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New card</button>
          <button className="btn" disabled={due.length === 0} onClick={() => setReviewing(due)}><Icon name="cards" size={16} />Review {due.length} due</button>
        </div>
      </div>
      <div className="grid three">
        <div className="card tile"><span className="icon-wrap"><Icon name="cards" /></span><div><strong>{data.cards.length}</strong><span className="muted small">Cards in your deck</span></div></div>
        <div className="card tile"><span className="icon-wrap"><Icon name="clock" /></span><div><strong>{due.length}</strong><span className="muted small">Due now</span></div></div>
        <div className="card tile"><span className="icon-wrap"><Icon name="award" /></span><div><strong>{data.cards.filter((card) => card.box >= 3).length}</strong><span className="muted small">Well known</span></div></div>
      </div>
      <div className="section">
        <div className="section-head"><h2>All cards</h2></div>
        {data.cards.length === 0 && <Empty icon="cards">Your deck is empty. Make flashcards from a lecture with the AI assistant, or add your own.</Empty>}
        {data.cards.map((card) => (
          <div className="item" key={card.id}>
            <div className="grow">
              <strong>{card.front}</strong>
              <span className="muted small">{card.back}{card.material_title ? ` · ${card.material_title}` : ''}</span>
            </div>
            <div className="side">
              <span className={card.is_due ? 'badge warn' : 'badge'}>{card.is_due ? 'Due' : `Next in ${timeUntil(card.due)}`}</span>
              <button className="icon-btn" aria-label="Delete card" onClick={async () => { await api(`/flashcards/${card.id}`, { method: 'DELETE' }); load() }}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {adding && <NewCard onClose={() => setAdding(false)} onSaved={load} />}
    </>
  )
}
