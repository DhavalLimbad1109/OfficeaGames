import { useState, useEffect } from 'react'
import { getPlayStatus } from '../hooks/usePlayLimit.js'
import { DIFFICULTY_CONFIG, getDifficultyFromScore } from '../utils/scoring.js'
import { GAME_META } from '../utils/gameUtils.js'

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

export default function GameHub({ player, weeklyScore, onPlay, onLeaderboard }) {
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

        <button className="btn-leaderboard" onClick={onLeaderboard}>
          🏆 Weekly Leaderboard
        </button>
      </div>
    </div>
  )
}
