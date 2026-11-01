import { useState } from 'react'
import { api, setToken } from '../api.js'
import { Avatar, Icon, Segmented } from '../components/ui.jsx'

const DEMO = [
  { name: 'Андрій Мельник', role: 'Студент', email: 'andrii@vns.demo' },
  { name: 'Марина Шевчук', role: 'Студент · староста групи', email: 'maryna@vns.demo' },
  { name: 'Олена Коваленко', role: 'Викладач', email: 'olena@vns.demo' },
  { name: 'Адміністратор VNS', role: 'Адміністратор', email: 'admin@vns.demo' },
]

const FEATURES = [
  { icon: 'calendar', title: 'Усі дедлайни в одному місці', text: 'Бачте, що й коли здавати, здавайте роботи та читайте відгуки викладача в тому ж курсі.' },
  { icon: 'award', title: 'Чесний прогноз оцінки', text: 'Зароблені бали, результат за оціненими роботами й максимум, який ще можна набрати.' },
  { icon: 'chat', title: 'Запитання лишаються в курсі', text: 'Q&A з прийнятими відповідями, оголошення з підтвердженням прочитання та особисті повідомлення.' },
  { icon: 'sparkle', title: 'AI-допомога за правилами викладача', text: 'Конспекти, картки й відповіді лише за матеріалами курсу, для оцінюваних лабораторних тільки підказки.' },
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
        <h1 style={{ marginTop: 40, maxWidth: 420 }}>Навчання, у якому все під контролем.</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 420 }}>Курси, дедлайни, запитання й оцінки для студентів і викладачів.</p>
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
          <h1>{mode === 'login' ? 'З поверненням' : 'Створіть акаунт'}</h1>
          <p className="muted">{mode === 'login' ? 'Увійдіть, щоб перейти до своїх курсів.' : 'Приєднайтеся до своєї групи та курсів.'}</p>
          <div style={{ marginTop: 18 }}>
            <Segmented value={mode} onChange={setMode} options={[{ value: 'login', label: 'Вхід' }, { value: 'register', label: 'Реєстрація' }]} />
          </div>
          <form className="stack" style={{ marginTop: 18 }} onSubmit={submit}>
            {mode === 'register' && (
              <>
                <label className="field">
                  <span className="label">Повне ім'я</span>
                  <input className="input" value={form.name} onChange={set('name')} placeholder="Андрій Мельник" required />
                </label>
                <div className="field">
                  <span className="label">Я</span>
                  <Segmented value={form.role} onChange={(role) => setForm({ ...form, role })} options={[{ value: 'student', label: 'студент' }, { value: 'teacher', label: 'викладач' }]} />
                </div>
                {form.role === 'student' && (
                  <label className="field">
                    <span className="label">Група</span>
                    <input className="input" value={form.grp} onChange={set('grp')} placeholder="КН-21" required />
                  </label>
                )}
              </>
            )}
            <label className="field">
              <span className="label">Електронна пошта</span>
              <input className="input" value={form.email} onChange={set('email')} placeholder="name@university.edu" autoFocus />
            </label>
            <label className="field">
              <span className="label">Пароль</span>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder={mode === 'login' ? 'Ваш пароль' : 'Щонайменше 4 символи'} />
            </label>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <button className="btn block" type="submit">{mode === 'login' ? 'Увійти' : 'Створити акаунт'}</button>
          </form>
          {mode === 'login' && (
            <>
              <div className="divider">або спробуйте демо-акаунт</div>
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
