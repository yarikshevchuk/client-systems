import { useState } from 'react'
import { api, setToken } from '../api.js'
import { Avatar, Choice, Icon } from '../components/ui.jsx'
import { lang, switchLang, t } from '../i18n.js'

const DEMO = [
  [t("Андрій Мельник"), t("Студент"), 'andrii@vns.demo'],
  [t("Марина Шевчук"), t("Студент · староста групи"), 'maryna@vns.demo'],
  [t("Олена Коваленко"), t("Викладач"), 'olena@vns.demo'],
  [t("Адміністратор VNS"), t("Адміністратор"), 'admin@vns.demo'],
]

const FEATURES = [
  ['calendar', t("Усі дедлайни в одному місці"), t("Бачте, що й коли здавати, здавайте роботи та читайте відгуки викладача в тому ж курсі.")],
  ['award', t("Чесний прогноз оцінки"), t("Зароблені бали, результат за оціненими роботами й максимум, який ще можна набрати.")],
  ['chat', t("Запитання лишаються в курсі"), t("Q&A з прийнятими відповідями, оголошення з підтвердженням прочитання та особисті повідомлення.")],
  ['sparkle', t("AI-допомога за правилами викладача"), t("Конспекти, картки й відповіді лише за матеріалами курсу, для оцінюваних лабораторних тільки підказки.")],
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
        <div className="brand"><span className="logo-mark">V</span>VNS</div>
        <h1 style={{ marginTop: 40, maxWidth: 420 }}>{t("Навчання, у якому все під контролем.")}</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: 420 }}>{t("Курси, дедлайни, запитання й оцінки для студентів і викладачів.")}</p>
        <div className="features">
          {FEATURES.map(([icon, title, text]) => (
            <div className="feature" key={title}>
              <span className="icon-wrap"><Icon name={icon} /></span>
              <div><strong>{title}</strong><p>{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-main">
        <div className="auth-box">
          <div className="row between">
            <div className="brand" style={{ padding: 0 }}><span className="logo-mark">V</span>VNS</div>
            <button className="btn secondary sm" onClick={switchLang}>{lang === 'en' ? 'Українська' : 'English'}</button>
          </div>
          <h1>{mode === 'login' ? t("З поверненням") : t("Створіть акаунт")}</h1>
          <p className="muted">{mode === 'login' ? t("Увійдіть, щоб перейти до своїх курсів.") : t("Приєднайтеся до своєї групи та курсів.")}</p>
          <div style={{ marginTop: 18 }}>
            <Choice value={mode} onChange={setMode} options={[['login', t("Вхід")], ['register', t("Реєстрація")]]} />
          </div>
          <form className="stack" style={{ marginTop: 18 }} onSubmit={submit}>
            {mode === 'register' && (
              <>
                <label className="field">
                  <span className="label">{t("Повне ім'я")}</span>
                  <input className="input" value={form.name} onChange={set('name')} placeholder={t("Андрій Мельник")} required />
                </label>
                <div className="field">
                  <span className="label">{t("Я")}</span>
                  <Choice value={form.role} onChange={(role) => setForm({ ...form, role })} options={[['student', t("студент")], ['teacher', t("викладач")]]} />
                </div>
                {form.role === 'student' && (
                  <label className="field">
                    <span className="label">{t("Група")}</span>
                    <input className="input" value={form.grp} onChange={set('grp')} placeholder={t("КН-21")} required />
                  </label>
                )}
              </>
            )}
            <label className="field">
              <span className="label">{t("Електронна пошта")}</span>
              <input className="input" value={form.email} onChange={set('email')} placeholder="name@university.edu" autoFocus />
            </label>
            <label className="field">
              <span className="label">{t("Пароль")}</span>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder={mode === 'login' ? t("Ваш пароль") : t("Щонайменше 4 символи")} />
            </label>
            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
            <button className="btn block" type="submit">{mode === 'login' ? t("Увійти") : t("Створити акаунт")}</button>
          </form>

          {mode === 'login' && (
            <>
              <div className="divider">{t("або спробуйте демо-акаунт")}</div>
              <div className="profiles">
                {DEMO.map(([name, role, email]) => (
                  <button key={email} className="profile" onClick={() => send('/login', { email, password: 'demo' })}>
                    <Avatar name={name} size={36} />
                    <span><strong>{name}</strong><span className="muted small">{role}</span></span>
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
