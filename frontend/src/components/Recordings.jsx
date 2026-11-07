import { useEffect, useRef, useState } from 'react'
import { api, getToken, timeAgo } from '../api.js'
import { Icon } from './ui.jsx'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function Recorder({ materialId, onSaved }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [segments, setSegments] = useState([])
  const [error, setError] = useState('')
  const session = useRef(null)

  async function start() {
    setError('')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
    if (!stream) return setError('Немає доступу до мікрофона. Дозвольте його в налаштуваннях браузера')

    const s = { stream, chunks: [], segments: [], began: Date.now() }
    s.recorder = new MediaRecorder(stream)
    s.recorder.ondataavailable = (event) => s.chunks.push(event.data)
    s.recorder.start()
    s.timer = setInterval(() => setSeconds((Date.now() - s.began) / 1000), 500)

    if (SpeechRecognition) {
      s.recognition = new SpeechRecognition()
      s.recognition.lang = 'uk-UA'
      s.recognition.continuous = true
      s.recognition.interimResults = true
      s.recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1]
        if (s.phraseStart === undefined) s.phraseStart = Math.round((Date.now() - s.began) / 1000)
        if (!result.isFinal) return
        s.segments.push({ start: s.phraseStart, text: result[0].transcript.trim() })
        s.phraseStart = undefined
        setSegments([...s.segments])
      }
      s.recognition.onend = () => s.recorder.state === 'recording' && s.recognition.start()
      s.recognition.start()
    }

    session.current = s
    setSegments([])
    setRecording(true)
  }

  function stop() {
    const s = session.current
    s.recorder.onstop = async () => {
      const form = new FormData()
      form.append('audio', new Blob(s.chunks, { type: s.recorder.mimeType }), 'lecture.webm')
      form.append('duration', String((Date.now() - s.began) / 1000))
      form.append('segments', JSON.stringify(s.segments))
      await api(`/materials/${materialId}/recordings`, { method: 'POST', body: form }).catch((err) => setError(err.message))
      onSaved()
    }
    clearInterval(s.timer)
    s.recognition?.stop()
    s.recorder.stop()
    s.stream.getTracks().forEach((track) => track.stop())
    setRecording(false)
  }

  if (!recording) {
    return (
      <div>
        <button className="btn" onClick={start}><Icon name="mic" size={16} />Записати голос</button>
        {!SpeechRecognition && <p className="muted small" style={{ marginTop: 8 }}>Цей браузер не розпізнає мову: запис збережеться без тексту. Для тексту відкрийте Chrome або Edge.</p>}
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="recorder">
      <div className="row">
        <span className="rec-dot" />
        <strong>Іде запис {clock(seconds)}</strong>
        <button className="btn secondary sm push" onClick={stop}><Icon name="stop" size={14} />Зупинити й зберегти</button>
      </div>
      <div className="live-text">
        {segments.length === 0 && <span className="muted">Говоріть — текст з’являтиметься тут</span>}
        {segments.map((segment, index) => <p key={index}><span className="stamp">{clock(segment.start)}</span>{segment.text}</p>)}
      </div>
    </div>
  )
}

function Player({ recording, canDelete, canAppend, onChanged, onAppended }) {
  const audio = useRef(null)
  const [src, setSrc] = useState(null)
  const [time, setTime] = useState(0)
  const [summary, setSummary] = useState(recording.summary)
  const [error, setError] = useState('')
  const segments = recording.segments || []
  const active = segments.findLastIndex((segment) => segment.start <= time)

  useEffect(() => {
    fetch(`/api/recordings/${recording.id}/audio`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((response) => response.blob())
      .then((blob) => setSrc(URL.createObjectURL(blob)))
  }, [recording.id])

  function seek(start) {
    audio.current.currentTime = start
    audio.current.play()
  }

  async function makeSummary() {
    await api(`/recordings/${recording.id}/summary`, { method: 'POST' }).then((data) => setSummary(data.summary)).catch((err) => setError(err.message))
  }

  async function append() {
    await api(`/recordings/${recording.id}/append`, { method: 'POST' })
    onAppended()
  }

  async function remove() {
    if (!confirm(`Видалити «${recording.title}» разом з текстом?`)) return
    await api(`/recordings/${recording.id}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <div className="recording">
      <div className="row wrap">
        <strong>{recording.title}</strong>
        <span className="badge">{recording.shared ? 'Для всіх' : 'Лише ви'}</span>
        <span className="muted small">{recording.author} · {timeAgo(recording.created_at)} · {clock(recording.duration)}</span>
        {canDelete && <button className="icon-btn push" title="Видалити запис" onClick={remove}><Icon name="trash" size={16} /></button>}
      </div>
      {src ? <audio ref={audio} src={src} controls onTimeUpdate={(event) => setTime(event.target.currentTime)} /> : <p className="muted small">Завантаження аудіо…</p>}
      {segments.length > 0 ? (
        <div className="transcript">
          {segments.map((segment, index) => (
            <button key={index} className={index === active ? 'segment active' : 'segment'} onClick={() => seek(segment.start)}>
              <span className="stamp">{clock(segment.start)}</span>{segment.text}
            </button>
          ))}
        </div>
      ) : <p className="muted small">Тексту немає: браузер не розпізнав мову під час запису.</p>}
      {error && <p className="error">{error}</p>}
      {summary && (
        <div className="ai-result">
          <span className="badge accent">Згенеровано AI</span>
          <ul>{summary.split('\n').map((line, index) => <li key={index}>{line.replace(/^[-•*]\s*/, '')}</li>)}</ul>
        </div>
      )}
      {segments.length > 0 && (
        <div className="row wrap">
          <button className="btn secondary sm" onClick={makeSummary}><Icon name="sparkle" size={14} />{summary ? 'Оновити AI-конспект запису' : 'AI-конспект запису'}</button>
          {canAppend && <button className="btn secondary sm" onClick={append}><Icon name="plus" size={14} />Додати текст до лекції</button>}
        </div>
      )}
    </div>
  )
}

export default function Recordings({ material, user, onAppended }) {
  const [list, setList] = useState([])

  const load = () => api(`/materials/${material.id}/recordings`).then(setList)
  useEffect(() => { load() }, [material.id])

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="mic" size={16} /></span>
        <h2>Записи лекції</h2>
        {list.length > 0 && <span className="badge">{list.length}</span>}
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {material.can_manage ? 'Запис бачать усі студенти курсу.' : 'Ваш запис бачите лише ви.'} Клік по реченню перемотує звук.
      </p>
      <Recorder materialId={material.id} onSaved={load} />
      <div className="stack" style={{ marginTop: 14 }}>
        {list.map((recording) => (
          <Player
            key={recording.id}
            recording={recording}
            canDelete={recording.author_id === user.id || material.can_manage}
            canAppend={material.can_manage}
            onChanged={load}
            onAppended={onAppended}
          />
        ))}
      </div>
    </div>
  )
}
