import { useState } from 'react'

export default function Registration({ onRegister }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Please enter a name')
    if (trimmed.length < 2) return setError('Name must be at least 2 characters')
    if (trimmed.length > 20) return setError('Name must be 20 characters or less')
    if (!/^[a-zA-Z0-9_ ]+$/.test(trimmed)) return setError('Only letters, numbers, spaces and underscores allowed')

    setLoading(true)
    setError('')
    try {
      await onRegister(trimmed)
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.')
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

        <form onSubmit={handleSubmit} className="reg-form">
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
          {error && <p className="error-msg">⚠️ {error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '⏳ Registering…' : '🚀 Join & Play'}
          </button>
        </form>

        <div className="rules-box">
          <p>📋 <strong>Rules:</strong></p>
          <ul>
            <li>🎯 2 games every 8 hours</li>
            <li>🔒 One account per computer/phone</li>
            <li>🏆 Weekly leaderboard (resets Mon 10AM IST)</li>
            <li>📈 Difficulty increases with your score</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
