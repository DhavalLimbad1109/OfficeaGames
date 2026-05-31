import { useState } from 'react'

export default function Registration({ onRegister, notice, requiresAuth }) {
  const [mode, setMode] = useState('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (requiresAuth && mode === 'signup') {
      if (!trimmedName) return setError('Please enter a player name')
      if (trimmedName.length < 2) return setError('Name must be at least 2 characters')
      if (trimmedName.length > 20) return setError('Name must be 20 characters or less')
      if (!/^[a-zA-Z0-9_ ]+$/.test(trimmedName)) return setError('Only letters, numbers, spaces and underscores allowed')
    }

    if (requiresAuth) {
      if (!normalizedEmail) return setError('Please enter your email')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Please enter a valid email')
      if (!password) return setError('Please enter your password')
      if (password.length < 6) return setError('Password must be at least 6 characters')
    } else if (!trimmedName) {
      return setError('Please enter a name')
    }

    setLoading(true)
    setError('')
    try {
      if (!requiresAuth) {
        await onRegister({ mode: 'local', name: trimmedName })
      } else {
        await onRegister({
          mode,
          name: trimmedName,
          email: normalizedEmail,
          password,
        })
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen-center">
      <div className="card registration-card">
        <div className="logo">🎮</div>
        <h1>Office<span className="accent">Games</span></h1>
        <p className="subtitle">Brain games for the office 🧠</p>

        {requiresAuth && (
          <div className="auth-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError('') }}
            >
              Sign Up
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => { setMode('signin'); setError('') }}
            >
              Sign In
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="reg-form">
          {(!requiresAuth || mode === 'signup') && (
            <>
              <label htmlFor="name">Choose your player name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                placeholder="e.g. CoolPlayer42"
                maxLength={20}
                autoFocus
                autoComplete="off"
              />
            </>
          )}

          {requiresAuth && (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@example.com"
                autoComplete={mode === 'signin' ? 'username' : 'email'}
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="At least 6 characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </>
          )}

          {notice && <p className="info-msg">ℹ️ {notice}</p>}
          {error && <p className="error-msg">⚠️ {error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? '⏳ Please wait…'
              : requiresAuth
                ? mode === 'signup'
                  ? '📩 Sign Up & Verify Email'
                  : '🔐 Sign In'
                : '🚀 Join & Play'}
          </button>
        </form>

        <div className="rules-box">
          <p>📋 <strong>Rules:</strong></p>
          <ul>
            <li>🎯 2 games every 8 hours</li>
            <li>🔒 One account per computer/phone</li>
            {requiresAuth && <li>📧 Email verification required</li>}
            <li>🏆 Weekly leaderboard (resets Mon 10AM IST)</li>
            <li>📈 Difficulty increases with your score</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
