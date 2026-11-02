import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ICONS = {
  home: (<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>),
  book: (<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  file: (<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>),
  upload: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  check: <polyline points="20 6 9 17 4 12" />,
  clock: (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" />,
  sliders: (<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>),
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>),
  plus: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  x: (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  down: <polyline points="6 9 12 15 18 9" />,
  up: <polyline points="18 15 12 9 6 15" />,
  left: <polyline points="15 18 9 12 15 6" />,
  right: <polyline points="9 18 15 12 9 6" />,
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  menu: (<><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>),
  send: (<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  users: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  award: (<><circle cx="12" cy="8" r="6" /><path d="M15.5 13.9 17 23l-5-3-5 3 1.5-9.1" /></>),
  alert: (<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>),
  help: (<><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  layers: (<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>),
  search: (<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  pin: (<><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" /></>),
  megaphone: (<><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>),
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>),
  trash: (<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>),
  user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  cards: (<><rect x="2" y="6" width="16" height="14" rx="2" /><path d="M6 6V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" /></>),
  eye: (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>),
}

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const PALETTE = ['#4c6ef5', '#0b9d86', '#e8590c', '#d6336c', '#7048e8', '#1098ad', '#c99a06']

export const colorFor = (key) => {
  const text = String(key)
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function Avatar({ name, size = 34 }) {
  const color = colorFor(name)
  const letters = name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: color + '1f', color }}>
      {letters}
    </span>
  )
}

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

function anchorStyle(button, height, width) {
  const rect = button.getBoundingClientRect()
  const w = width || rect.width
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8))
  const place = window.innerHeight - rect.bottom > height ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }
  return { ...place, left, width: w }
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? 'toggle on' : 'toggle'} onClick={() => onChange(!checked)} />
  )
}

export function Select({ value, onChange, options, placeholder = 'Оберіть…' }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(null)
  const ref = useRef(null)
  const button = useRef(null)
  useClickOutside(ref, () => setOpen(false))
  const current = options.find((option) => option.value === value)

  function toggle() {
    if (!open) setStyle(anchorStyle(button.current, 260))
    setOpen(!open)
  }

  return (
    <div className="select" ref={ref} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <button type="button" ref={button} className="select-button" aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
        <span className={current ? '' : 'placeholder'}>{current ? current.label : placeholder}</span>
        <Icon name="down" size={16} />
      </button>
      {open && (
        <ul className="select-list" role="listbox" style={style}>
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'selected' : ''}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
              {option.value === value && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => onChange(option.value)}>
          <Icon name={option.icon} size={16} />
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 100, placeholder = '', small = false }) {
  const number = value === '' ? 0 : value
  const clamp = (n) => Math.min(max, Math.max(min, n))
  return (
    <div className={small ? 'stepper sm' : 'stepper'}>
      <button type="button" aria-label="Зменшити" disabled={value !== '' && number <= min} onClick={() => onChange(clamp(number - 1))}>−</button>
      <input
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          onChange(digits === '' ? '' : clamp(parseInt(digits, 10)))
        }}
      />
      <button type="button" aria-label="Збільшити" disabled={number >= max} onClick={() => onChange(clamp(number + 1))}>+</button>
    </div>
  )
}

const formatSize = (bytes) => (bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' МБ' : Math.max(1, Math.round(bytes / 1024)) + ' КБ')

export function FileDrop({ file, onChange, hint }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)

  function take(files) {
    if (files && files[0]) onChange(files[0])
  }

  return (
    <>
      <input ref={input} type="file" hidden onChange={(event) => take(event.target.files)} />
      {file ? (
        <div className="file-chosen">
          <span className="icon-wrap"><Icon name="file" size={20} /></span>
          <div className="grow">
            <strong>{file.name}</strong>
            <span className="muted small">{formatSize(file.size)}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="Видалити файл" onClick={() => { onChange(null); input.current.value = '' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : (
        <div
          className={over ? 'dropzone over' : 'dropzone'}
          role="button"
          tabIndex={0}
          onClick={() => input.current.click()}
          onKeyDown={(event) => event.key === 'Enter' && input.current.click()}
          onDragOver={(event) => { event.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => { event.preventDefault(); setOver(false); take(event.dataTransfer.files) }}
        >
          <span className="icon-wrap"><Icon name="upload" size={20} /></span>
          <div><strong>Перетягніть файл сюди</strong> або натисніть, щоб обрати</div>
          <span className="muted small">{hint}</span>
        </div>
      )}
    </>
  )
}

const pad = (n) => String(n).padStart(2, '0')
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function DateTimeField({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(null)
  const ref = useRef(null)
  const button = useRef(null)
  useClickOutside(ref, () => setOpen(false))
  const selected = value ? new Date(value) : null
  const [month, setMonth] = useState(() => {
    const base = selected || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [time, setTime] = useState(value ? value.slice(11, 16) : '23:59')

  const offset = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const today = new Date()
  const same = (a, b) => a && b && a.toDateString() === b.toDateString()

  function pick(day) {
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${TIME.test(time) ? time : '23:59'}`)
  }

  function changeTime(text) {
    setTime(text)
    if (TIME.test(text) && value) onChange(value.slice(0, 11) + text)
  }

  const label = selected ? selected.toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Оберіть дату й час'

  return (
    <div className="picker" ref={ref} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        ref={button}
        className="select-button"
        onClick={() => {
          if (!open) setStyle(anchorStyle(button.current, 360, 288))
          setOpen(!open)
        }}
      >
        <span className={selected ? '' : 'placeholder'}>{label}</span>
        <Icon name="calendar" size={16} />
      </button>
      {open && (
        <div className="popover" style={style}>
          <div className="cal-head">
            <button type="button" className="icon-btn" aria-label="Попередній місяць" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="left" size={16} /></button>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
            <button type="button" className="icon-btn" aria-label="Наступний місяць" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="right" size={16} /></button>
          </div>
          <div className="cal-grid">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((name) => <span key={name} className="dow">{name}</span>)}
            {cells.map((day, index) =>
              day === null ? (
                <span key={'blank' + index} />
              ) : (
                <button
                  key={day}
                  type="button"
                  className={[same(selected, new Date(month.getFullYear(), month.getMonth(), day)) ? 'sel' : '', same(today, new Date(month.getFullYear(), month.getMonth(), day)) ? 'today' : ''].join(' ')}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              )
            )}
          </div>
          <div className="cal-foot">
            <span className="muted small">Час (24 год)</span>
            <input className="input" value={time} onChange={(event) => changeTime(event.target.value)} placeholder="23:59" />
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>Готово</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Закрити" onClick={onClose}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ProgressBar({ percent, color }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: Math.min(100, Math.max(0, percent)) + '%', background: color }} />
    </div>
  )
}

export function Empty({ icon, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={24} />
      <div>{children}</div>
    </div>
  )
}

const ToastContext = createContext(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((text, tone = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, text, tone }])
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((item) => (
          <div key={item.id} className={item.tone === 'bad' ? 'toast bad' : 'toast'}>
            <Icon name={item.tone === 'bad' ? 'alert' : 'check'} size={16} />
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function Menu({ items, label = 'Дії' }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(null)
  const ref = useRef(null)
  const button = useRef(null)
  useClickOutside(ref, () => setOpen(false))

  function toggle() {
    if (!open) setStyle(anchorStyle(button.current, items.length * 40 + 20, 190))
    setOpen(!open)
  }

  return (
    <div className="menu" ref={ref}>
      <button type="button" ref={button} className="icon-btn" aria-label={label} onClick={toggle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
      </button>
      {open && (
        <ul className="select-list menu-list" style={style} role="menu">
          {items.filter(Boolean).map((item) => (
            <li
              key={item.label}
              role="menuitem"
              className={item.danger ? 'danger' : ''}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Confirm({ title, text, confirm = 'Видалити', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{text}</p>
      <div className="modal-foot">
        <button type="button" className="btn secondary" onClick={onClose}>Скасувати</button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirm}
        </button>
      </div>
    </Modal>
  )
}

export function Loading() {
  return <p className="muted">Завантаження…</p>
}
