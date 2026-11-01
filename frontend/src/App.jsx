import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, getToken, roleName, setToken } from './api.js'
import { Avatar, colorFor, Icon, Loading } from './components/ui.jsx'
import Notifications from './components/Notifications.jsx'
import { LiveProvider, useLive } from './live.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Course from './pages/Course.jsx'
import Material from './pages/Material.jsx'
import Messages from './pages/Messages.jsx'
import Spaces from './pages/Spaces.jsx'
import Space from './pages/Space.jsx'
import Calendar from './pages/Calendar.jsx'
import Flashcards from './pages/Flashcards.jsx'
import Search from './pages/Search.jsx'
import Profile from './pages/Profile.jsx'

const Settings = lazy(() => import('./pages/Settings.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="logo-mark">V</span>
      VNS
    </Link>
  )
}

function SearchBox() {
  const navigate = useNavigate()
  const [text, setText] = useState('')

  return (
    <form
      className="searchbox"
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim()) navigate(`/search?q=${encodeURIComponent(text.trim())}`)
      }}
    >
      <Icon name="search" size={16} />
      <input placeholder="Пошук курсів, матеріалів, повідомлень…" value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  )
}

function Shell({ user, setUser, logout }) {
  const [courses, setCourses] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [dueCards, setDueCards] = useState(0)
  const location = useLocation()
  const { counters } = useLive()

  const loadCourses = useCallback(() => api('/courses').then(setCourses), [])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    if (user.role === 'student') api('/flashcards').then((data) => setDueCards(data.due))
  }, [location.pathname, user.role])

  const link = ({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')

  return (
    <div className="shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <Brand />
        <nav className="nav">
          <NavLink to="/" end className={link}><Icon name="home" /><span className="text">Головна</span></NavLink>
          <NavLink to="/calendar" className={link}><Icon name="calendar" /><span className="text">Календар</span></NavLink>
          <NavLink to="/messages" className={link}>
            <Icon name="chat" /><span className="text">Повідомлення</span>
            {counters.messages > 0 && <span className="count">{counters.messages}</span>}
          </NavLink>
          <NavLink to="/spaces" className={link}><Icon name="users" /><span className="text">Навчальні простори</span></NavLink>
          {user.role === 'student' && (
            <NavLink to="/flashcards" className={link}>
              <Icon name="cards" /><span className="text">Картки</span>
              {dueCards > 0 && <span className="count">{dueCards}</span>}
            </NavLink>
          )}
          {user.role === 'admin' && <NavLink to="/admin" className={link}><Icon name="shield" /><span className="text">Адмінка</span></NavLink>}
          <div className="nav-label">Курси</div>
          {courses.map((course) => (
            <NavLink key={course.id} to={`/courses/${course.id}`} className={link}>
              <span className="dot" style={{ background: colorFor(course.id) }} />
              <span className="text">{course.title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link to="/profile" className="me">
            <Avatar name={user.name} />
            <span className="who">
              <strong>{user.name}</strong>
              <span>{roleName(user.role)}</span>
            </span>
          </Link>
          <button className="icon-btn" onClick={logout} aria-label="Вийти" title="Вийти"><Icon name="logout" /></button>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <div className="content">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Відкрити меню"><Icon name="menu" /></button>
          <div className="mobile-brand"><Brand /></div>
          <SearchBox />
          <Notifications />
        </header>
        <main>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} onCoursesChanged={loadCourses} />} />
              <Route path="/courses/:id" element={<Course user={user} />} />
              <Route path="/courses/:id/settings" element={<Settings user={user} onCoursesChanged={loadCourses} />} />
              <Route path="/materials/:id" element={<Material user={user} />} />
              <Route path="/messages" element={<Messages user={user} />} />
              <Route path="/messages/:otherId" element={<Messages user={user} />} />
              <Route path="/spaces" element={<Spaces user={user} />} />
              <Route path="/spaces/:id" element={<Space user={user} />} />
              <Route path="/calendar" element={<Calendar user={user} />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile" element={<Profile user={user} onChanged={setUser} />} />
              <Route path="/admin" element={<Admin user={user} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
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
    if (!getToken()) {
      setReady(true)
      return
    }
    api('/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true))
  }, [])

  function logout() {
    setToken(null)
    setUser(null)
    navigate('/')
  }

  if (!ready) return <p className="center">Завантаження…</p>
  if (!user) return <Login onLogin={setUser} />

  return (
    <LiveProvider user={user}>
      <Shell user={user} setUser={setUser} logout={logout} />
    </LiveProvider>
  )
}
