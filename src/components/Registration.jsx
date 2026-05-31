import { useEffect, useState } from 'react'

export default function Registration({ onSendOtp, onVerifyOtp, onRegisterLocal, notice, requiresAuth }) {
  const [mode, setMode] = useState('signup')
  const [step, setStep] = useState('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => {
      setCooldown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  async function handleDetailsSubmit(e) {
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
    } else if (!trimmedName) {
      return setError('Please enter a name')
    }

    setLoading(true)
    setError('')
    try {
      if (!requiresAuth) {
        await onRegisterLocal(trimmedName)
      } else {
        await onSendOtp({
          mode,
          name: trimmedName,
          email: normalizedEmail,
        })
        setOtp('')
        setStep('otp')
        setCooldown(60)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const token = otp.trim()
    if (!token) return setError('Please enter the OTP code from your email.')
    if (token.length !== 6) return setError('OTP must be 6 digits.')

    setLoading(true)
    setError('')
    try {
      await onVerifyOtp({
        mode,
        email: normalizedEmail,
        name: name.trim(),
        token,
      })
    } catch (err) {
      if (mode === 'signin' && (err.message || '').includes('Invalid or expired OTP')) {
        setError('Invalid or expired OTP. If this email is new, go back and use Sign Up.')
      } else {
        setError(err.message || 'OTP verification failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || loading) return
    setLoading(true)
    setError('')
    try {
      await onSendOtp({
        mode,
        name: name.trim(),
        email: email.trim().toLowerCase(),
      })
      setCooldown(60)
    } catch (err) {
      setError(err.message || 'Could not resend OTP. Try again.')
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
              onClick={() => {
                setMode('signup')
                setStep('details')
                setOtp('')
                setError('')
              }}
            >
              Sign Up
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setMode('signin')
                setStep('details')
                setOtp('')
                setError('')
              }}
            >
              Sign In
            </button>
          </div>
        )}

        {step === 'details' ? (
          <form onSubmit={handleDetailsSubmit} className="reg-form">
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
                  autoComplete="email"
                />
              </>
            )}

            {notice && <p className="info-msg">ℹ️ {notice}</p>}
            {error && <p className="error-msg">⚠️ {error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? '⏳ Please wait…'
                : requiresAuth
                  ? '📨 Send OTP'
                  : '🚀 Join & Play'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="reg-form">
            <p className="otp-meta">
              Enter the OTP sent to <strong>{email.trim().toLowerCase()}</strong>
            </p>
            <label htmlFor="otp">Email OTP</label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={e => {
                const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 6)
                setOtp(onlyDigits)
                setError('')
              }}
              placeholder="6-digit code"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
            />

            {notice && <p className="info-msg">ℹ️ {notice}</p>}
            {error && <p className="error-msg">⚠️ {error}</p>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Verifying…' : '✅ Verify OTP'}
            </button>

            <div className="otp-actions">
              <button
                type="button"
                className="btn-secondary small"
                onClick={() => {
                  setStep('details')
                  setOtp('')
                  setError('')
                }}
                disabled={loading}
              >
                ⬅ Back
              </button>
              <button
                type="button"
                className="btn-secondary small"
                onClick={handleResendOtp}
                disabled={loading || cooldown > 0}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : '🔁 Resend OTP'}
              </button>
            </div>
          </form>
        )}

        <div className="rules-box">
          <p>📋 <strong>Rules:</strong></p>
          <ul>
            <li>🎯 2 games every 8 hours</li>
            <li>🔒 One account per computer/phone</li>
            {requiresAuth && <li>📧 Email OTP required</li>}
            <li>🏆 Weekly leaderboard (resets Mon 10AM IST)</li>
            <li>📈 Difficulty increases with your score</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
