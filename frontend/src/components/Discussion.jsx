import { useEffect, useState } from 'react'
import { api, download, plural, timeAgo } from '../api.js'
import { useLive } from '../live.js'
import { Avatar, Choice, Empty, Icon, Loading } from './ui.jsx'

function sendMessage(courseId, channel, text, file, parentId = null) {
  if (!file) return api(`/courses/${courseId}/messages`, { method: 'POST', body: { channel, text, parent_id: parentId } })
  const form = new FormData()
  form.append('channel', channel)
  form.append('text', text)
  form.append('file', file)
  if (parentId) form.append('parent_id', parentId)
  return api(`/courses/${courseId}/messages/file`, { method: 'POST', body: form })
}

function Composer({ placeholder, button = 'Надіслати', onSend }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)

  async function submit(event) {
    event.preventDefault()
    await onSend(text, file).catch((err) => alert(err.message))
    setText('')
    setFile(null)
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label className="icon-btn" title="Прикріпити файл">
        <Icon name="upload" size={18} />
        <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
      </label>
      <div className="grow">
        <input className="input" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        {file && <span className="file-chip"><Icon name="file" size={14} />{file.name}<button type="button" className="link-btn" onClick={() => setFile(null)}>×</button></span>}
      </div>
      <button type="submit" className="btn" disabled={!text.trim() && !file}><Icon name="send" size={16} />{button}</button>
    </form>
  )
}

function MessageBody({ message, children }) {
  return (
    <>
      <div className="head">
        <strong>{message.author}</strong>
        {message.role === 'teacher' && <span className="badge accent">Викладач</span>}
        <span>{timeAgo(message.created_at)}</span>
        {message.accepted && <span className="badge ok"><Icon name="check" size={12} />Прийнята відповідь</span>}
        {children}
      </div>
      <div className="body">{message.text}</div>
      {message.file_name && (
        <button className="file-chip" onClick={() => download(`/messages/${message.id}/file`, message.file_name)}><Icon name="file" size={14} />{message.file_name}</button>
      )}
    </>
  )
}

function Questions({ courseId, messages, user, canManage, reload }) {
  const [filter, setFilter] = useState('all')
  const [replyTo, setReplyTo] = useState(null)
  const questions = messages.filter((m) => !m.parent_id).reverse()
  const shown = questions.filter((q) => filter === 'all' || (filter === 'open') !== q.resolved)

  async function call(path, options) {
    await api(path, options)
    reload()
  }

  async function ask(text, file) {
    await sendMessage(courseId, 'qa', text, file)
    reload()
  }

  async function reply(question, text, file) {
    await sendMessage(courseId, 'qa', text, file, question.id)
    setReplyTo(null)
    reload()
  }

  const canDelete = (message) => message.user_id === user.id || canManage
  const deleteButton = (message) => canDelete(message) && (
    <button className="icon-btn" title="Видалити" onClick={() => call(`/messages/${message.id}`, { method: 'DELETE' })}><Icon name="trash" size={15} /></button>
  )

  return (
    <>
      <div className="card">
        <div className="card-title">
          <span className="icon-wrap"><Icon name="help" size={16} /></span>
          <h2>Поставити питання</h2>
        </div>
        <Composer placeholder="Що ви хочете дізнатися?" button="Опублікувати питання" onSend={ask} />
      </div>
      <div className="row between wrap" style={{ margin: '20px 0 12px' }}>
        <h2>{questions.length} {plural(questions.length, 'питання', 'питання', 'питань')}</h2>
        <Choice value={filter} onChange={setFilter} options={[['all', 'Усі'], ['open', 'Відкриті'], ['resolved', 'З відповіддю']]} />
      </div>
      {shown.length === 0 && <Empty icon="chat">Тут немає питань.</Empty>}

      {shown.map((question) => (
        <article className={question.resolved ? 'card thread resolved' : 'card thread'} key={question.id}>
          <div className="msg">
            <Avatar name={question.author} />
            <div className="grow">
              <MessageBody message={question}>
                {question.resolved ? <span className="badge ok"><Icon name="check" size={12} />Є відповідь</span> : <span className="badge warn">Відкрите</span>}
              </MessageBody>
            </div>
            {deleteButton(question)}
          </div>
          <div className="replies">
            {messages.filter((m) => m.parent_id === question.id).map((answer) => (
              <div className={answer.accepted ? 'msg reply accepted' : 'msg reply'} key={answer.id}>
                <Avatar name={answer.author} size={30} />
                <div className="grow"><MessageBody message={answer} /></div>
                <div className="row">
                  {(question.user_id === user.id || canManage) && (
                    <button className="btn ghost sm" onClick={() => call(`/messages/${answer.id}/accept`, { method: 'POST' })}>{answer.accepted ? 'Зняти позначку' : 'Прийняти'}</button>
                  )}
                  {deleteButton(answer)}
                </div>
              </div>
            ))}
          </div>
          {replyTo === question.id
            ? <Composer placeholder="Напишіть відповідь…" button="Відповісти" onSend={(text, file) => reply(question, text, file)} />
            : <button className="btn ghost sm" onClick={() => setReplyTo(question.id)}><Icon name="chat" size={14} />Відповісти</button>}
        </article>
      ))}
    </>
  )
}

function Chat({ courseId, channel, messages, user, canManage, reload }) {
  async function send(text, file) {
    await sendMessage(courseId, channel.id, text, file)
    reload()
  }

  async function remove(message) {
    await api(`/messages/${message.id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <div className="card">
      <div className="channel-head"><b># {channel.title}</b><span className="muted small">{channel.hint}</span></div>
      <div className="chat">
        {messages.length === 0 && <Empty icon="chat">У цьому каналі ще немає повідомлень.</Empty>}
        {messages.map((message) => (
          <div key={message.id} className="msg">
            <Avatar name={message.author} />
            <div className="bubble"><MessageBody message={message} /></div>
            {(message.user_id === user.id || canManage) && <button className="icon-btn" title="Видалити" onClick={() => remove(message)}><Icon name="trash" size={15} /></button>}
          </div>
        ))}
        <div ref={(end) => end?.scrollIntoView({ block: 'nearest' })} />
      </div>
      <Composer placeholder={`Написати в # ${channel.title}…`} onSend={send} />
    </div>
  )
}

export default function Discussion({ courseId, user, canManage }) {
  const [channels, setChannels] = useState(null)
  const [channelId, setChannelId] = useState('qa')
  const [messages, setMessages] = useState(null)

  const load = () => api(`/courses/${courseId}/messages?channel=${channelId}`).then(setMessages)

  useEffect(() => {
    api(`/courses/${courseId}/channels`).then(setChannels)
  }, [courseId])

  useEffect(() => {
    setMessages(null)
    load()
  }, [courseId, channelId])

  useLive((event) => {
    if (event.course_id === Number(courseId) || event.message?.course_id === Number(courseId)) load()
  })

  if (!channels || !messages) return <Loading />
  const channel = channels.find((item) => item.id === channelId)
  const props = { courseId, messages, user, canManage, reload: load }

  return (
    <div className="discussion-layout">
      <nav className="channel-list">
        {channels.map((item) => (
          <button key={item.id} className={item.id === channelId ? 'active' : ''} onClick={() => setChannelId(item.id)} title={item.hint}>
            <span className="hash">#</span>{item.title}
          </button>
        ))}
      </nav>
      <div className="channel-main">
        {channelId === 'qa' ? <Questions {...props} /> : <Chat {...props} channel={channel} />}
      </div>
    </div>
  )
}
