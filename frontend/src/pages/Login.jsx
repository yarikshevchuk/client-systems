import { useState } from 'react'
import { api, setToken } from '../api.js'
import { Avatar, Icon } from '../components/ui.jsx'

const DEMO = [
  { name: 'Andrii Melnyk', role: 'Student', email: 'andrii@vns.demo' },
  { name: 'Maryna Shevchuk', role: 'Student · head of group', email: 'maryna@vns.demo' },
  { name: 'Olena Kovalenko', role: 'Lecturer', email: 'olena@vns.demo' },
]

const FEATURES = [
  { icon: 'calendar', title: 'Deadlines in one place', text: 'See what is due and submit your work without leaving the course.' },
  { icon: 'award', title: 'An honest grade forecast', text: 'Earned points, result on graded work and the maximum you can still reach.' },
  { icon: 'chat', title: 'Questions stay in the course', text: 'Course Q&A replaces scattered messengers, so answers are easy to find.' },
  { icon: 'sparkle', title: 'AI help, set by the lecturer', text: 'Summaries and answers only from course materials, hints only for graded labs.' },
]

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function signIn(emailValue, passwordValue) {
    setError('')
    try {
      const data = await api('/login', { method: 'POST', body: { email: emailValue, password: passwordValue } })
      setToken(data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    }
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
          <h1>Welcome back</h1>
          <p className="muted">Log in to continue to your courses.</p>
          <form
            className="stack"
            style={{ marginTop: 22 }}
            onSubmit={(event) => {
              event.preventDefault()
              signIn(email, password)
            }}
          >
            <label className="field">
              <span className="label">Email</span>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@university.edu" autoFocus />
            </label>
            <label className="field">
              <span className="label">Password</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            </label>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <button className="btn block" type="submit">Log in</button>
          </form>
          <div className="divider">or try a demo account</div>
          <div className="profiles">
            {DEMO.map((account) => (
              <button key={account.email} className="profile" onClick={() => signIn(account.email, 'demo')}>
                <Avatar name={account.name} size={36} />
                <span>
                  <strong>{account.name}</strong>
                  <span className="muted small">{account.role}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
