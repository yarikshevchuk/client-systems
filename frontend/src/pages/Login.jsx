import { useState } from 'react'
import { api, setToken } from '../api.js'
import { Avatar, Icon, Segmented } from '../components/ui.jsx'

const DEMO = [
  { name: 'Andrii Melnyk', role: 'Student', email: 'andrii@vns.demo' },
  { name: 'Maryna Shevchuk', role: 'Student · head of group', email: 'maryna@vns.demo' },
  { name: 'Olena Kovalenko', role: 'Lecturer', email: 'olena@vns.demo' },
  { name: 'Admin VNS', role: 'Administrator', email: 'admin@vns.demo' },
]

const FEATURES = [
  { icon: 'calendar', title: 'Deadlines in one place', text: 'See what is due, submit your work and read the lecturer\'s feedback in the same course.' },
  { icon: 'award', title: 'An honest grade forecast', text: 'Earned points, result on graded work and the maximum you can still reach.' },
  { icon: 'chat', title: 'Questions stay in the course', text: 'Q&A with accepted answers, announcements with read confirmation and direct messages.' },
  { icon: 'sparkle', title: 'AI help, set by the lecturer', text: 'Summaries, flashcards and answers only from course materials, hints only for graded labs.' },
]

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', grp: '' })
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function send(path, body) {
    setError('')
    try {
      const data = await api(path, { method: 'POST', body })
      setToken(data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    }
  }

  function submit(event) {
    event.preventDefault()
    if (mode === 'login') send('/login', { email: form.email, password: form.password })
    else send('/register', form)
  }

  return (
    <div className="auth">
      <section className="auth-side">
        <div className="brand">
          <span className="logo-mark">V</span>
          VNS
        </div>
        <h1 style={{ marginTop: 40, maxWidth: 420 }}>Learning that stays organised.</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 420 }}>Courses, deadlines, questions and grades for students and lecturers.</p>
        <div className="features">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.title}>
              <span className="icon-wrap"><Icon name={feature.icon} /></span>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="auth-main">
        <div className="auth-box">
          <div className="brand" style={{ padding: 0 }}>
            <span className="logo-mark">V</span>
            VNS
          </div>
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted">{mode === 'login' ? 'Log in to continue to your courses.' : 'Join your group and your courses.'}</p>
          <div style={{ marginTop: 18 }}>
            <Segmented value={mode} onChange={setMode} options={[{ value: 'login', label: 'Log in' }, { value: 'register', label: 'Sign up' }]} />
          </div>
          <form className="stack" style={{ marginTop: 18 }} onSubmit={submit}>
            {mode === 'register' && (
              <>
                <label className="field">
                  <span className="label">Full name</span>
                  <input className="input" value={form.name} onChange={set('name')} placeholder="Andrii Melnyk" required />
                </label>
                <div className="field">
                  <span className="label">I am</span>
                  <Segmented value={form.role} onChange={(role) => setForm({ ...form, role })} options={[{ value: 'student', label: 'a student' }, { value: 'teacher', label: 'a lecturer' }]} />
                </div>
                {form.role === 'student' && (
                  <label className="field">
                    <span className="label">Group</span>
                    <input className="input" value={form.grp} onChange={set('grp')} placeholder="CS-21" required />
                  </label>
                )}
              </>
            )}
            <label className="field">
              <span className="label">Email</span>
              <input className="input" value={form.email} onChange={set('email')} placeholder="name@university.edu" autoFocus />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder={mode === 'login' ? 'Your password' : 'At least 4 characters'} />
            </label>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <button className="btn block" type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
          </form>
          {mode === 'login' && (
            <>
              <div className="divider">or try a demo account</div>
              <div className="profiles">
                {DEMO.map((account) => (
                  <button key={account.email} className="profile" onClick={() => send('/login', { email: account.email, password: 'demo' })}>
                    <Avatar name={account.name} size={36} />
                    <span>
                      <strong>{account.name}</strong>
                      <span className="muted small">{account.role}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
