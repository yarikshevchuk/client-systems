import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api, getToken, setToken } from './api.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Course from './pages/Course.jsx'
import Material from './pages/Material.jsx'

const Settings = lazy(() => import('./pages/Settings.jsx'))

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

  if (!ready) return <p className="center">Loading…</p>
  if (!user) return <Login onLogin={setUser} />

  return (
    <>
      <header className="bar">
        <Link to="/" className="logo">VNS</Link>
        <span className="who">
          {user.name} · {user.role}
        </span>
        <button className="link" onClick={logout}>Log out</button>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/courses/:id" element={<Course user={user} />} />
          <Route
            path="/courses/:id/settings"
            element={
              <Suspense fallback={<p>Loading…</p>}>
                <Settings user={user} />
              </Suspense>
            }
          />
          <Route path="/materials/:id" element={<Material user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  )
}
