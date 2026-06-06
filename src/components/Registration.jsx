import { useState } from 'react'

export default function Registration({
  onPlayerLogin,
  onSetFirstPassword,
  onCreatePlayer,
  onRegisterLocal,
  onBootstrapAdmin,
  notice,
  requiresAuth,
  requiresPasswordReset,
  adminBootstrapRequired,
}) {
  const [panel, setPanel] = useState('player')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [localName, setLocalName] = useState('')

  const [playerUsername, setPlayerUsername] = useState('')
  const [playerPassword, setPlayerPassword] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerUsername, setNewPlayerUsername] = useState('')
  const [newPlayerPassword, setNewPlayerPassword] = useState('')

  const [bootstrapUsername, setBootstrapUsername] = useState('')
  const [bootstrapPassword, setBootstrapPassword] = useState('')
  const [bootstrapConfirmPassword, setBootstrapConfirmPassword] = useState('')

  async function handleLocalRegister(e) {
    e.preventDefault()
    const trimmedName = localName.trim()
    if (!trimmedName) {
      setError('Please enter a player name.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onRegisterLocal(trimmedName)
    } catch (err) {
      setError(err.message || 'Could not continue.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePlayerLogin(e) {
    e.preventDefault()
    const username = playerUsername.trim().toLowerCase()
    if (!username) {
      setError('Please enter username.')
      return
    }
    if (!playerPassword) {
      setError('Please enter password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onPlayerLogin({ username, password: playerPassword })
      setPlayerPassword('')
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFirstPasswordSubmit(e) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSetFirstPassword({ password: newPassword })
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setError(err.message || 'Could not set password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePlayer(e) {
    e.preventDefault()
    const playerName = newPlayerName.trim()
    const playerUsernameValue = newPlayerUsername.trim().toLowerCase()
    if (!adminUsername.trim() || !adminPassword) {
      setError('Please enter admin credentials.')
      return
    }
    if (!playerName || !playerUsernameValue || !newPlayerPassword) {
      setError('Please fill all player fields.')
      return
    }
    if (newPlayerPassword.length < 6) {
      setError('Temporary password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onCreatePlayer({
        adminUsername: adminUsername.trim().toLowerCase(),
        adminPassword,
        playerName,
        playerUsername: playerUsernameValue,
        temporaryPassword: newPlayerPassword,
      })
      setNewPlayerName('')
      setNewPlayerUsername('')
      setNewPlayerPassword('')
    } catch (err) {
      setError(err.message || 'Could not create player.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBootstrapAdmin(e) {
    e.preventDefault()
    const username = bootstrapUsername.trim().toLowerCase()
    if (!username || !bootstrapPassword) {
      setError('Please enter admin username and password.')
      return
    }
    if (bootstrapPassword.length < 6) {
      setError('Admin password must be at least 6 characters.')
      return
    }
    if (bootstrapPassword !== bootstrapConfirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onBootstrapAdmin({ username, password: bootstrapPassword })
      setBootstrapPassword('')
      setBootstrapConfirmPassword('')
    } catch (err) {
      setError(err.message || 'Could not create first admin.')
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

        {!requiresAuth ? (
          <form onSubmit={handleLocalRegister} className="reg-form">
            <label htmlFor="local-name">Choose your player name</label>
            <input
              id="local-name"
              type="text"
              value={localName}
              onChange={e => { setLocalName(e.target.value); setError('') }}
              placeholder="e.g. CoolPlayer42"
              maxLength={20}
              autoFocus
              autoComplete="off"
            />
            {notice && <p className="info-msg">ℹ️ {notice}</p>}
            {error && <p className="error-msg">⚠️ {error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Please wait…' : '🚀 Join & Play'}
            </button>
          </form>
        ) : requiresPasswordReset ? (
          <form onSubmit={handleFirstPasswordSubmit} className="reg-form">
            <p className="otp-meta">First login detected. Set your new password to continue.</p>
            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError('') }}
              minLength={6}
              autoFocus
              autoComplete="new-password"
            />
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmNewPassword}
              onChange={e => { setConfirmNewPassword(e.target.value); setError('') }}
              minLength={6}
              autoComplete="new-password"
            />
            {notice && <p className="info-msg">ℹ️ {notice}</p>}
            {error && <p className="error-msg">⚠️ {error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Updating…' : '✅ Save Password'}
            </button>
          </form>
        ) : (
          <>
            <div className="auth-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${panel === 'player' ? 'active' : ''}`}
                onClick={() => {
                  setPanel('player')
                  setError('')
                }}
              >
                Player Login
              </button>
              <button
                type="button"
                className={`mode-btn ${panel === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  setPanel('admin')
                  setError('')
                }}
              >
                Admin Panel
              </button>
            </div>

            {panel === 'player' ? (
              <form onSubmit={handlePlayerLogin} className="reg-form">
                <label htmlFor="player-username">Username</label>
                <input
                  id="player-username"
                  type="text"
                  value={playerUsername}
                  onChange={e => { setPlayerUsername(e.target.value); setError('') }}
                  placeholder="player username"
                  autoFocus
                  autoComplete="username"
                />
                <label htmlFor="player-password">Password</label>
                <input
                  id="player-password"
                  type="password"
                  value={playerPassword}
                  onChange={e => { setPlayerPassword(e.target.value); setError('') }}
                  placeholder="password"
                  autoComplete="current-password"
                />
                {notice && <p className="info-msg">ℹ️ {notice}</p>}
                {error && <p className="error-msg">⚠️ {error}</p>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? '⏳ Signing in…' : '🔐 Login'}
                </button>
              </form>
            ) : adminBootstrapRequired ? (
              <form onSubmit={handleBootstrapAdmin} className="reg-form">
                <p className="otp-meta">Create the first admin account.</p>
                <label htmlFor="bootstrap-admin-username">Admin Username</label>
                <input
                  id="bootstrap-admin-username"
                  type="text"
                  value={bootstrapUsername}
                  onChange={e => { setBootstrapUsername(e.target.value); setError('') }}
                  placeholder="admin username"
                  autoFocus
                  autoComplete="username"
                />
                <label htmlFor="bootstrap-admin-password">Admin Password</label>
                <input
                  id="bootstrap-admin-password"
                  type="password"
                  value={bootstrapPassword}
                  onChange={e => { setBootstrapPassword(e.target.value); setError('') }}
                  placeholder="min 6 characters"
                  autoComplete="new-password"
                />
                <label htmlFor="bootstrap-admin-confirm-password">Confirm Password</label>
                <input
                  id="bootstrap-admin-confirm-password"
                  type="password"
                  value={bootstrapConfirmPassword}
                  onChange={e => { setBootstrapConfirmPassword(e.target.value); setError('') }}
                  placeholder="confirm password"
                  autoComplete="new-password"
                />
                {notice && <p className="info-msg">ℹ️ {notice}</p>}
                {error && <p className="error-msg">⚠️ {error}</p>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? '⏳ Creating…' : '👑 Create First Admin'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreatePlayer} className="reg-form">
                <label htmlFor="admin-username">Admin Username</label>
                <input
                  id="admin-username"
                  type="text"
                  value={adminUsername}
                  onChange={e => { setAdminUsername(e.target.value); setError('') }}
                  placeholder="admin username"
                  autoFocus
                  autoComplete="username"
                />
                <label htmlFor="admin-password">Admin Password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={e => { setAdminPassword(e.target.value); setError('') }}
                  placeholder="admin password"
                  autoComplete="current-password"
                />
                <label htmlFor="player-name">Player Name</label>
                <input
                  id="player-name"
                  type="text"
                  value={newPlayerName}
                  onChange={e => { setNewPlayerName(e.target.value); setError('') }}
                  placeholder="display name"
                  maxLength={20}
                  autoComplete="off"
                />
                <label htmlFor="player-login-username">Player Username</label>
                <input
                  id="player-login-username"
                  type="text"
                  value={newPlayerUsername}
                  onChange={e => { setNewPlayerUsername(e.target.value); setError('') }}
                  placeholder="login username"
                  autoComplete="off"
                />
                <label htmlFor="player-temp-password">Temporary Password</label>
                <input
                  id="player-temp-password"
                  type="password"
                  value={newPlayerPassword}
                  onChange={e => { setNewPlayerPassword(e.target.value); setError('') }}
                  placeholder="temporary password"
                  autoComplete="new-password"
                />
                {notice && <p className="info-msg">ℹ️ {notice}</p>}
                {error && <p className="error-msg">⚠️ {error}</p>}
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? '⏳ Creating player…' : '➕ Create Player'}
                </button>
              </form>
            )}
          </>
        )}

        <div className="rules-box">
          <p>📋 <strong>Rules:</strong></p>
          <ul>
            <li>🎯 2 games every 8 hours</li>
            <li>🔒 One account per computer/phone</li>
            {requiresAuth && <li>👑 Admin creates player login accounts</li>}
            <li>🏆 Weekly leaderboard (resets Mon 10AM IST)</li>
            <li>📈 Difficulty increases with your score</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
