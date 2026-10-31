import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, getToken, setToken } from './api.js'
import { Avatar, colorFor, Icon } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Course from './pages/Course.jsx'
import Material from './pages/Material.jsx'

const Settings = lazy(() => import('./pages/Settings.jsx'))

function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="logo-mark">V</span>
      VNS
    </Link>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [courses, setCourses] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const loadCourses = useCallback(() => api('/courses').then(setCourses), [])

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

  useEffect(() => {
    if (user) loadCourses()
  }, [user, loadCourses])

  useEffect(() => setMenuOpen(false), [location.pathname])

  function logout() {
    setToken(null)
    setUser(null)
    setCourses([])
    navigate('/')
  }

  if (!ready) return <p className="center">Loading…</p>
  if (!user) return <Login onLogin={setUser} />

  return (
    <div className="shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <Brand />
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Icon name="home" />
            <span className="text">Dashboard</span>
          </NavLink>
          <div className="nav-label">Courses</div>
          {courses.map((course) => (
            <NavLink key={course.id} to={`/courses/${course.id}`} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <span className="dot" style={{ background: colorFor(course.id) }} />
              <span className="text">{course.title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Avatar name={user.name} />
          <div className="who">
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <div className="content">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <Brand />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard user={user} onCoursesChanged={loadCourses} />} />
            <Route path="/courses/:id" element={<Course user={user} />} />
            <Route
              path="/courses/:id/settings"
              element={
                <Suspense fallback={<p className="muted">Loading…</p>}>
                  <Settings user={user} />
                </Suspense>
              }
            />
            <Route path="/materials/:id" element={<Material user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
