import { useEffect, useState } from 'react'
import { api, fmt } from '../api.js'
import { Empty, Icon, Loading, Modal, ProgressBar } from '../components/ui.jsx'
import { t } from '../i18n.js'

function NewCard({ onClose, onSaved }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  async function save(event) {
    event.preventDefault()
    await api('/flashcards', { method: 'POST', body: { front, back } })
    onSaved()
    onClose()
  }

  return (
    <Modal title={t("Нова картка")} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="label">{t("Питання")}</span>
          <textarea className="textarea" value={front} onChange={(e) => setFront(e.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span className="label">{t("Відповідь")}</span>
          <textarea className="textarea" value={back} onChange={(e) => setBack(e.target.value)} required />
        </label>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>{t("Скасувати")}</button>
          <button type="submit" className="btn">{t("Додати картку")}</button>
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
        <h2>{t("Сесію завершено")}</h2>
        <p className="muted">{t("Правильних відповідей:")} {right} {t("з")} {cards.length}.</p>
        <button className="btn" onClick={onDone}>{t("Назад до колоди")}</button>
      </div>
    )
  }

  return (
    <div className="card review">
      <div className="row between">
        <span className="muted small">{t("Картка")} {index + 1} {t("з")} {cards.length}</span>
        <button className="link-btn small" onClick={onDone}>{t("Завершити сесію")}</button>
      </div>
      <ProgressBar percent={(100 * index) / cards.length} color="var(--ink)" />
      <div className="flash">
        <p className="front">{card.front}</p>
        {shown && <p className="back">{card.back}</p>}
      </div>
      {!shown && <button className="btn block" onClick={() => setShown(true)}>{t("Показати відповідь")}</button>}
      {shown && (
        <div className="row">
          <button className="btn secondary block" onClick={() => answer(false)}>{t("Не знав(ла)")}</button>
          <button className="btn block" onClick={() => answer(true)}>{t("Знав(ла)")}</button>
        </div>
      )}
    </div>
  )
}

export default function Flashcards() {
  const [data, setData] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = () => api('/flashcards').then(setData)
  useEffect(() => { load() }, [])

  async function remove(card) {
    await api(`/flashcards/${card.id}`, { method: 'DELETE' })
    load()
  }

  if (!data) return <Loading />
  const due = data.cards.filter((card) => card.is_due)

  if (reviewing) {
    return (
      <>
        <div className="page-head"><h1>{t("Повторення")}</h1></div>
        <Review cards={reviewing} onDone={() => { setReviewing(null); load() }} />
      </>
    )
  }

  const tiles = [['cards', data.cards.length, t("Карток у колоді")], ['clock', due.length, t("Час повторити")], ['award', data.cards.filter((card) => card.box >= 3).length, t("Добре знаєте")]]

  return (
    <>
      <div className="page-head">
        <h1>{t("Картки")}</h1>
        <div className="row">
          <button className="btn secondary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{t("Нова картка")}</button>
          <button className="btn" disabled={due.length === 0} onClick={() => setReviewing(due)}><Icon name="cards" size={16} />{t("Повторити:")} {due.length}</button>
        </div>
      </div>
      <div className="grid three">
        {tiles.map(([icon, value, label]) => (
          <div className="card tile" key={label}><span className="icon-wrap"><Icon name={icon} /></span><div><strong>{value}</strong><span className="muted small">{label}</span></div></div>
        ))}
      </div>
      <div className="section">
        <div className="section-head"><h2>{t("Усі картки")}</h2></div>
        {data.cards.length === 0 && <Empty icon="cards">{t("Колода порожня. Створіть картки з лекції за допомогою AI-помічника або додайте власні.")}</Empty>}
        {data.cards.map((card) => (
          <div className="item" key={card.id}>
            <div className="grow">
              <strong>{card.front}</strong>
              <span className="muted small">{card.back}{card.material_title && ` · ${card.material_title}`}</span>
            </div>
            <div className="side">
              <span className={card.is_due ? 'badge warn' : 'badge'}>{card.is_due ? t("Час повторити") : `${t("Повторити")} ${fmt(card.due)}`}</span>
              <button className="icon-btn" title={t("Видалити картку")} onClick={() => remove(card)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      {adding && <NewCard onClose={() => setAdding(false)} onSaved={load} />}
    </>
  )
}
