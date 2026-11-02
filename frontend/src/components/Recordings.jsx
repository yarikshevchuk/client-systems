import { useEffect, useRef, useState } from 'react'
import { api, getToken, timeAgo } from '../api.js'
import { Confirm, Icon, useToast } from './ui.jsx'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

const clock = (seconds) => {
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Recorder({ materialId, onSaved }) {
  const [state, setState] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [segments, setSegments] = useState([])
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const live = useRef({})
  const toast = useToast()

  useEffect(() => () => stopAll(), [])

  function stopAll() {
    const r = live.current
    clearInterval(r.timer)
    if (r.recognition) {
      r.recognition.onend = null
      r.recognition.stop()
    }
    if (r.stream) r.stream.getTracks().forEach((track) => track.stop())
  }

  async function start() {
    setError('')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Немає доступу до мікрофона. Дозвольте його в налаштуваннях браузера')
      return
    }
    const r = { stream, chunks: [], segments: [], began: Date.now(), phraseStart: null }
    r.recorder = new MediaRecorder(stream)
    r.recorder.ondataavailable = (event) => event.data.size && r.chunks.push(event.data)
    r.recorder.start(1000)
    r.timer = setInterval(() => setElapsed((Date.now() - r.began) / 1000), 250)
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang = 'uk-UA'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        const now = (Date.now() - r.began) / 1000
        let partial = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          if (r.phraseStart === null) r.phraseStart = now
          if (result.isFinal) {
            const text = result[0].transcript.trim()
            if (text) {
              r.segments = [...r.segments, { start: Math.round(r.phraseStart * 10) / 10, text }]
              setSegments(r.segments)
            }
            r.phraseStart = null
          } else {
            partial += result[0].transcript
          }
        }
        setInterim(partial)
      }
      recognition.onend = () => {
        if (live.current === r && r.recorder.state === 'recording') {
          try { recognition.start() } catch { /* already started */ }
        }
      }
      recognition.start()
      r.recognition = recognition
    }
    live.current = r
    setSegments([])
    setInterim('')
    setElapsed(0)
    setState('recording')
  }

  function finish() {
    const r = live.current
    const duration = (Date.now() - r.began) / 1000
    r.recorder.onstop = async () => {
      stopAll()
      setState('saving')
      const form = new FormData()
      form.append('audio', new Blob(r.chunks, { type: r.recorder.mimeType || 'audio/webm' }), 'lecture.webm')
      form.append('duration', String(duration))
      form.append('segments', JSON.stringify(r.segments))
      try {
        await api(`/materials/${materialId}/recordings`, { method: 'POST', body: form })
        toast(r.segments.length ? 'Запис збережено з текстом' : 'Запис збережено без тексту')
        onSaved()
      } catch (err) {
        setError(err.message)
      }
      setState('idle')
    }
    r.recorder.stop()
  }

  if (state === 'idle') {
    return (
      <div>
        <button className="btn" onClick={start}><Icon name="mic" size={16} />Записати голос</button>
        {!SpeechRecognition && <p className="muted small" style={{ marginTop: 8 }}>Цей браузер не розпізнає мову: запис збережеться без тексту. Для тексту відкрийте Chrome або Edge.</p>}
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    )
  }

  if (state === 'saving') return <p className="muted">Зберігаємо запис…</p>

  return (
    <div className="recorder">
      <div className="row">
        <span className="rec-dot" />
        <strong>Іде запис {clock(elapsed)}</strong>
        <button className="btn secondary sm push" onClick={finish}><Icon name="stop" size={14} />Зупинити й зберегти</button>
      </div>
      <div className="live-text">
        {segments.length === 0 && !interim && <span className="muted">Говоріть — текст з’являтиметься тут</span>}
        {segments.map((segment, index) => <p key={index}><span className="stamp">{clock(segment.start)}</span>{segment.text}</p>)}
        {interim && <p className="muted">{interim}</p>}
      </div>
    </div>
  )
}

function Player({ recording, canManage, user, onChanged, onAppended }) {
  const audio = useRef(null)
  const [src, setSrc] = useState(null)
  const [time, setTime] = useState(0)
  const [summary, setSummary] = useState(recording.summary)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const toast = useToast()
  const mine = recording.author_id === user.id
  const segments = recording.segments || []
  const active = segments.reduce((found, segment, index) => (segment.start <= time + 0.2 ? index : found), -1)

  useEffect(() => {
    let url
    let cancelled = false
    fetch(`/api/recordings/${recording.id}/audio`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => setError('Не вдалося завантажити аудіо'))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [recording.id])

  useEffect(() => {
    document.querySelector(`#seg-${recording.id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, recording.id])

  function seek(start) {
    audio.current.currentTime = start
    audio.current.play().catch(() => {})
  }

  async function makeSummary() {
    setBusy(true)
    setError('')
    try {
      const data = await api(`/recordings/${recording.id}/summary`, { method: 'POST' })
      setSummary(data.summary)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  async function append() {
    try {
      await api(`/recordings/${recording.id}/append`, { method: 'POST' })
      toast('Текст запису додано до лекції')
      onAppended()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove() {
    await api(`/recordings/${recording.id}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <div className="recording">
      <div className="row wrap">
        <strong>{recording.title}</strong>
        <span className="badge">{recording.shared ? 'Для всіх' : 'Лише ви'}</span>
        <span className="muted small">{recording.author} · {timeAgo(recording.created_at)} · {clock(recording.duration)}</span>
        {(mine || canManage) && <button className="icon-btn push" aria-label="Видалити запис" onClick={() => setConfirm(true)}><Icon name="trash" size={16} /></button>}
      </div>
      {src ? <audio ref={audio} src={src} controls preload="metadata" onTimeUpdate={(event) => setTime(event.target.currentTime)} /> : <p className="muted small">Завантаження аудіо…</p>}
      {segments.length > 0 ? (
        <div className="transcript">
          {segments.map((segment, index) => (
            <button key={index} id={`seg-${recording.id}-${index}`} className={index === active ? 'segment active' : 'segment'} onClick={() => src && seek(segment.start)}>
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
      <div className="row wrap">
        {segments.length > 0 && <button className="btn secondary sm" onClick={makeSummary} disabled={busy}><Icon name="sparkle" size={14} />{summary ? 'Оновити AI-конспект запису' : 'AI-конспект запису'}</button>}
        {canManage && segments.length > 0 && <button className="btn secondary sm" onClick={append}><Icon name="plus" size={14} />Додати текст до лекції</button>}
      </div>
      {confirm && <Confirm title="Видалити запис" text={`Видалити «${recording.title}» разом з текстом?`} onConfirm={remove} onClose={() => setConfirm(false)} />}
    </div>
  )
}

export default function Recordings({ material, user, onAppended }) {
  const [list, setList] = useState(null)

  function load() {
    api(`/materials/${material.id}/recordings`).then(setList)
  }

  useEffect(load, [material.id])

  return (
    <div className="card">
      <div className="card-title">
        <span className="icon-wrap"><Icon name="mic" size={16} /></span>
        <h2>Записи лекції</h2>
        {list && list.length > 0 && <span className="badge">{list.length}</span>}
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {material.can_manage ? 'Запис бачать усі студенти курсу. Клік по реченню перемотує звук.' : 'Ваш запис бачите лише ви. Клік по реченню перемотує звук.'}
      </p>
      <Recorder materialId={material.id} onSaved={load} />
      <div className="stack" style={{ marginTop: 14 }}>
        {list && list.map((recording) => (
          <Player key={recording.id} recording={recording} user={user} canManage={material.can_manage} onChanged={load} onAppended={onAppended} />
        ))}
      </div>
    </div>
  )
}
