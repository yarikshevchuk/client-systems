import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, timeAgo } from '../api.js'
import { useLiveEvents } from '../live.jsx'
import { Avatar, Confirm, Empty, Icon, Loading, useToast } from '../components/ui.jsx'

export default function Space({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [text, setText] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef(null)
  const toast = useToast()

  function load() {
    api(`/spaces/${id}`).then(setData).catch((err) => setError(err.message))
  }

  useEffect(() => {
    setData(null)
    load()
  }, [id])
  useLiveEvents((event) => {
    if (event.type === 'space_message' && event.message.space_id === Number(id)) load()
  })
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [data])

  async function act(path, message) {
    try {
      await api(path, { method: 'POST' })
      if (message) toast(message)
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function send(event) {
    event.preventDefault()
    if (!text.trim()) return
    try {
      await api(`/spaces/${id}/messages`, { method: 'POST', body: { text } })
      setText('')
      load()
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  async function remove() {
    await api(`/spaces/${id}`, { method: 'DELETE' })
    toast('Space deleted')
    navigate('/spaces')
  }

  if (error) return <p className="error">{error}</p>
  if (!data) return <Loading />
  const { space, joined, members, messages } = data
  const owner = space.owner_id === user.id

  return (
    <>
      <Link to="/spaces" className="crumb"><Icon name="left" size={16} />Study spaces</Link>
      <div className="page-head">
        <div>
          <h1>{space.title}</h1>
          <p className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            {space.topic && <span className="badge">{space.topic}</span>}
            <span>Created by {space.owner}</span>
          </p>
          {space.description && <p style={{ marginTop: 8 }}>{space.description}</p>}
        </div>
        <div className="row">
          {joined && !owner && <button className="btn secondary" onClick={() => act(`/spaces/${id}/leave`, 'You left the space')}>Leave</button>}
          {!joined && <button className="btn" onClick={() => act(`/spaces/${id}/join`, 'You joined the space')}><Icon name="plus" size={16} />Join space</button>}
          {(owner || user.role === 'admin') && <button className="btn secondary" onClick={() => setConfirm(true)}><Icon name="trash" size={16} />Delete</button>}
        </div>
      </div>
      <div className="space-layout">
        <div className="card">
          {!joined ? (
            <Empty icon="users">Join this space to read and write messages.</Empty>
          ) : (
            <>
              <div className="chat">
                {messages.length === 0 && <Empty icon="chat">No messages yet. Start the conversation.</Empty>}
                {messages.map((message) => (
                  <div key={message.id} className="msg">
                    <Avatar name={message.author} />
                    <div className="bubble">
                      <div className="head"><strong>{message.author}</strong><span>{timeAgo(message.created_at)}</span></div>
                      <div className="body">{message.text}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="composer" onSubmit={send}>
                <input className="input" placeholder="Write to the space…" value={text} onChange={(e) => setText(e.target.value)} />
                <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={16} />Send</button>
              </form>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-title"><h2>Members ({members.length})</h2></div>
          {members.map((member) => (
            <div className="row" key={member.id} style={{ padding: '6px 0' }}>
              <Avatar name={member.name} size={30} />
              <span>{member.name}</span>
              {member.id === space.owner_id && <span className="badge push">Owner</span>}
            </div>
          ))}
        </div>
      </div>
      {confirm && <Confirm title="Delete space" text="Delete this space with all its messages?" onConfirm={remove} onClose={() => setConfirm(false)} />}
    </>
  )
}
