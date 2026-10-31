import { useState } from 'react'
import { api, setToken } from '../api.js'

const DEMO = [
  { label: 'Andrii (student)', email: 'andrii@vns.demo' },
  { label: 'Maryna (student)', email: 'maryna@vns.demo' },
  { label: 'Olena (lecturer)', email: 'olena@vns.demo' },
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
    <div className="login card">
      <h1>VNS</h1>
      <p className="muted">One place for courses, deadlines, questions and grades.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          signIn(email, password)
        }}
      >
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Log in</button>
      </form>
      <p className="muted">Demo accounts (local demo only):</p>
      <div className="row wrap">
        {DEMO.map((account) => (
          <button key={account.email} className="secondary" onClick={() => signIn(account.email, 'demo')}>
            {account.label}
          </button>
        ))}
      </div>
    </div>
  )
}
