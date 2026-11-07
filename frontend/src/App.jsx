import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, getToken, roleName, setToken } from './api.js'
import { connectLive, disconnectLive, useLive } from './live.js'
import { Avatar, colorFor, Icon } from './components/ui.jsx'
import Notifications from './components/Notifications.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Course from './pages/Course.jsx'
import Settings from './pages/Settings.jsx'
import Material from './pages/Material.jsx'
import Messages from './pages/Messages.jsx'
import Spaces from './pages/Spaces.jsx'
import Space from './pages/Space.jsx'
import Calendar from './pages/Calendar.jsx'
import Flashcards from './pages/Flashcards.jsx'
import Search from './pages/Search.jsx'
import Profile from './pages/Profile.jsx'
import Admin from './pages/Admin.jsx'
import { lang, switchLang, t } from './i18n.js'

function Shell({ user, setUser, logout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [counters, setCounters] = useState({ notifications: 0, messages: 0 })
  const [dueCards, setDueCards] = useState(0)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark')
  const [online, setOnline] = useState(navigator.onLine)

  const loadCourses = () => api('/courses').then(setCourses)
  const loadCounters = () => api('/me/counters').then(setCounters)

  useEffect(() => {
    loadCourses()
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    loadCounters()
    if (user.role === 'student') api('/flashcards').then((data) => setDueCards(data.due))
  }, [location.pathname])

  useLive((event) => {
    if (event.type === 'notification' || event.type === 'dm') loadCounters()
  })

  function toggleTheme() {
    const theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
    setDark(!dark)
  }

  function search(event) {
    event.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const link = ({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label={t("Відкрити меню")}><Icon name="menu" /></button>
        <Link to="/" className="brand">
          <span className="logo-mark">V</span>
          <span className="brand-text">VNS<small>{t("Навчальна платформа")}</small></span>
        </Link>
        <form className="searchbox" onSubmit={search}>
          <Icon name="search" size={16} />
          <input placeholder={t("Пошук курсів, матеріалів, повідомлень…")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
        <Notifications count={counters.notifications} onRead={loadCounters} />
        <button className="icon-btn" onClick={toggleTheme} title={dark ? t("Світла тема") : t("Темна тема")}><Icon name={dark ? 'sun' : 'moon'} /></button>
        <button className="icon-btn lang-btn" onClick={switchLang} title={t("Мова інтерфейсу")}>{lang === 'en' ? 'UA' : 'EN'}</button>
        <Link to="/profile" className="me">
          <Avatar name={user.name} size={30} />
          <span className="who"><strong>{user.name}</strong><span>{roleName(user.role)}</span></span>
        </Link>
        <button className="icon-btn" onClick={logout} title={t("Вийти")}><Icon name="logout" /></button>
      </header>

      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <nav className="nav">
          <NavLink to="/" end className={link}><Icon name="home" /><span className="text">{t("Головна")}</span></NavLink>
          <NavLink to="/calendar" className={link}><Icon name="calendar" /><span className="text">{t("Календар")}</span></NavLink>
          <NavLink to="/messages" className={link}>
            <Icon name="chat" /><span className="text">{t("Повідомлення")}</span>
            {counters.messages > 0 && <span className="count">{counters.messages}</span>}
          </NavLink>
          <NavLink to="/spaces" className={link}><Icon name="users" /><span className="text">{t("Навчальні простори")}</span></NavLink>
          {user.role === 'student' && (
            <NavLink to="/flashcards" className={link}>
              <Icon name="cards" /><span className="text">{t("Картки")}</span>
              {dueCards > 0 && <span className="count">{dueCards}</span>}
            </NavLink>
          )}
          {user.role === 'admin' && <NavLink to="/admin" className={link}><Icon name="shield" /><span className="text">{t("Адмінка")}</span></NavLink>}
          <div className="nav-label">{t("Курси")}</div>
          {courses.map((course) => (
            <NavLink key={course.id} to={`/courses/${course.id}`} className={link}>
              <span className="dot" style={{ background: colorFor(course.id) }} />
              <span className="text">{course.title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="content">
        <main>
          {!online && <div className="offline-bar">{t("Немає з’єднання з інтернетом. Показано збережені дані, зміни недоступні.")}</div>}
          <Routes>
            <Route path="/" element={<Dashboard user={user} onCoursesChanged={loadCourses} />} />
            <Route path="/courses/:id" element={<Course user={user} />} />
            <Route path="/courses/:id/settings" element={<Settings user={user} onCoursesChanged={loadCourses} />} />
            <Route path="/materials/:id" element={<Material user={user} />} />
            <Route path="/messages/:otherId?" element={<Messages user={user} onRead={loadCounters} />} />
            <Route path="/spaces" element={<Spaces />} />
            <Route path="/spaces/:id" element={<Space user={user} />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile user={user} onChanged={setUser} />} />
            <Route path="/admin" element={<Admin user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!getToken()) return setReady(true)
    api('/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!user) return
    connectLive()
    return disconnectLive
  }, [user?.id])

  function logout() {
    if (window.caches) caches.delete('vns-data-v1')
    setToken(null)
    setUser(null)
    navigate('/')
  }

  if (!ready) return <p className="center">{t("Завантаження…")}</p>
  if (!user) return <Login onLogin={setUser} />
  return <Shell user={user} setUser={setUser} logout={logout} />
}
