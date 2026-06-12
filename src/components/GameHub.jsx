import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { getPlayStatus } from '../hooks/usePlayLimit.js'
import { DIFFICULTY_CONFIG, getDifficultyFromScore } from '../utils/scoring.js'
import { GAME_META } from '../utils/gameUtils.js'
import QuestionManager from './QuestionManager.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import BulkImport from './BulkImport.jsx'

function formatCountdown(target) {
  const diff = target - new Date()
  if (diff <= 0) return 'available now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function AdminPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('players') // 'players' | 'questions' | 'dashboard' | 'import'
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')

  // Player creation state
  const [playerName, setPlayerName] = useState('')
  const [playerUsername, setPlayerUsername] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdminAuth(e) {
    e.preventDefault()
    if (!adminUsername.trim() || !adminPassword) {
      setAuthError('Enter admin credentials.')
      return
    }
    // Verify by calling needs_admin_bootstrap (lightweight) then try a list call
    try {
      const { error: rpcError } = await supabase.rpc('admin_list_questions', {
        _admin_username: adminUsername.trim().toLowerCase(),
        _admin_password: adminPassword,
        _game_type: 'anagram',
        _difficulty: 'easy',
      })
      if (rpcError) throw rpcError
      setAuthenticated(true)
      setAuthError('')
    } catch (err) {
      setAuthError('Invalid admin credentials.')
    }
  }

  async function handleCreatePlayer(e) {
    e.preventDefault()
    if (!playerName.trim() || !playerUsername.trim() || !tempPassword) {
      setError('Fill all player fields.')
      return
    }
    if (tempPassword.length < 6) {
      setError('Temporary password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const { error: rpcError } = await supabase.rpc('admin_create_player', {
        _admin_username: adminUsername.trim().toLowerCase(),
        _admin_password: adminPassword,
        _player_name: playerName.trim(),
        _player_username: playerUsername.trim().toLowerCase(),
        _temporary_password: tempPassword,
      })
      if (rpcError) throw rpcError
      setMessage(`Player "${playerUsername.trim().toLowerCase()}" created!`)
      setPlayerName('')
      setPlayerUsername('')
      setTempPassword('')
    } catch (err) {
      const msg = err?.message || ''
      if (msg.includes('invalid_admin_credentials')) setError('Invalid admin credentials.')
      else if (msg.includes('player_name_taken')) setError('Player name is already taken.')
      else if (msg.includes('player_username_taken')) setError('Username is already taken.')
      else setError(msg || 'Failed to create player.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button className="btn-admin-toggle" onClick={() => setOpen(true)}>
        👑 Admin Panel
      </button>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <span>👑 Admin Panel</span>
        <button className="admin-close-btn" onClick={() => { setOpen(false); setError(''); setMessage(''); setAuthError('') }}>✕</button>
      </div>

      {!authenticated ? (
        <form onSubmit={handleAdminAuth} className="admin-form">
          <input
            type="text"
            placeholder="Admin username"
            value={adminUsername}
            onChange={e => { setAdminUsername(e.target.value); setAuthError('') }}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Admin password"
            value={adminPassword}
            onChange={e => { setAdminPassword(e.target.value); setAuthError('') }}
            autoComplete="current-password"
          />
          {authError && <p className="admin-error">{authError}</p>}
          <button type="submit" className="btn-primary">Authenticate</button>
        </form>
      ) : (
        <>
          <div className="admin-tabs">
            <button className={`admin-tab ${tab === 'players' ? 'active' : ''}`} onClick={() => setTab('players')}>
              Add Players
            </button>
            <button className={`admin-tab ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>
              Questions
            </button>
            <button className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
              Dashboard
            </button>
            <button className={`admin-tab ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
              Import
            </button>
          </div>

          {tab === 'dashboard' ? (
            <AdminDashboard adminUsername={adminUsername.trim().toLowerCase()} adminPassword={adminPassword} />
          ) : tab === 'import' ? (
            <BulkImport adminUsername={adminUsername.trim().toLowerCase()} adminPassword={adminPassword} />
          ) : tab === 'players' ? (
            <form onSubmit={handleCreatePlayer} className="admin-form">
              <input
                type="text"
                placeholder="Player display name"
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError('') }}
                maxLength={20}
                autoComplete="off"
              />
              <input
                type="text"
                placeholder="Player username (login)"
                value={playerUsername}
                onChange={e => { setPlayerUsername(e.target.value); setError('') }}
                autoComplete="off"
              />
              <input
                type="password"
                placeholder="Temporary password (min 6)"
                value={tempPassword}
                onChange={e => { setTempPassword(e.target.value); setError('') }}
                autoComplete="new-password"
              />
              {message && <p className="admin-success">{message}</p>}
              {error && <p className="admin-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating...' : '+ Create Player'}
              </button>
            </form>
          ) : (
            <QuestionManager adminUsername={adminUsername.trim().toLowerCase()} adminPassword={adminPassword} />
          )}
        </>
      )}
    </div>
  )
}

export default function GameHub({ player, weeklyScore, isAdmin, onPlay, onLeaderboard, onStats, onDaily, onLogout }) {
  const [playStatus, setPlayStatus] = useState(getPlayStatus())
  const [countdown, setCountdown] = useState('')

  const difficulty = getDifficultyFromScore(weeklyScore)
  const diffCfg = DIFFICULTY_CONFIG[difficulty]

  useEffect(() => {
    const interval = setInterval(() => {
      const status = getPlayStatus()
      setPlayStatus(status)
      if (status.nextPlayTime) {
        setCountdown(formatCountdown(status.nextPlayTime))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const nextPoints = difficulty === 'easy' ? 51 : difficulty === 'medium' ? 151 : null
  const playsLabel = Number.isFinite(playStatus.playsRemaining) ? `${playStatus.playsRemaining}/2` : '∞'

  return (
    <div className="screen-center">
      <div className="hub-container">
        <header className="hub-header">
          <div className="hub-title">🎮 Office<span className="accent">Games</span></div>
          <div className="hub-player">👤 {player.name}</div>
        </header>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">🏅</span>
            <span className="stat-value">{weeklyScore}</span>
            <span className="stat-label">Weekly Score</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">{diffCfg.emoji}</span>
            <span className="stat-value">{diffCfg.label}</span>
            <span className="stat-label">Difficulty</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎯</span>
            <span className="stat-value">{playsLabel}</span>
            <span className="stat-label">Plays Left</span>
          </div>
        </div>

        {nextPoints && (
          <div className="progress-hint">
            🔼 Reach <strong>{nextPoints} pts</strong> to unlock{' '}
            {difficulty === 'easy' ? 'Medium' : 'Hard'} difficulty
          </div>
        )}

        <div className="games-preview">
          {Object.entries(GAME_META).map(([key, meta]) => (
            <div key={key} className="game-chip" style={{ borderColor: meta.color }}>
              <span>{meta.emoji}</span>
              <span>{meta.name}</span>
            </div>
          ))}
        </div>

        {playStatus.playsRemaining > 0 ? (
          <button className="btn-play" onClick={onPlay}>
            🎲 Play Random Game
          </button>
        ) : (
          <div className="blocked-play">
            <p>🔒 Next play in <strong>{countdown}</strong></p>
            <p className="blocked-sub">Come back after {playStatus.nextPlayTime?.toLocaleTimeString()}</p>
          </div>
        )}

        <div className="hub-actions-row">
          <button className="btn-hub-action" onClick={onStats}>
            📊 Stats
          </button>
          <button className="btn-hub-action daily" onClick={onDaily}>
            🌟 Daily
          </button>
        </div>

        <button className="btn-leaderboard" onClick={onLeaderboard}>
          🏆 Weekly Leaderboard
        </button>

        {supabase && isAdmin && <AdminPanel />}

        <button className="btn-logout" onClick={onLogout}>
          🚪 Logout
        </button>
      </div>
    </div>
  )
}
