import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { getWeekStart, getNextResetIST, formatCountdown } from '../utils/weeklyReset.js'

export default function Leaderboard({ player, onBack }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetIn, setResetIn] = useState('')

  useEffect(() => {
    loadLeaderboard()
    const nextReset = getNextResetIST()
    const interval = setInterval(() => setResetIn(formatCountdown(nextReset)), 1000)
    setResetIn(formatCountdown(nextReset))
    return () => clearInterval(interval)
  }, [])

  async function loadLeaderboard() {
    setLoading(true)
    try {
      if (supabase) {
        const weekStart = getWeekStart()
        const { data, error } = await supabase
          .from('game_sessions')
          .select('score, player_id, players(name)')
          .eq('week_start', weekStart)
        if (error) throw error

        // Aggregate by player
        const map = {}
        for (const row of data) {
          const name = row.players?.name || 'Unknown'
          if (!map[name]) map[name] = { name, totalScore: 0, games: 0 }
          map[name].totalScore += row.score
          map[name].games += 1
        }

        const sorted = Object.values(map).sort((a, b) => b.totalScore - a.totalScore)
        setRows(sorted)
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="screen-center">
      <div className="card leaderboard-card">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>🏆 Weekly Leaderboard</h2>
        <p className="reset-info">🔄 Resets in <strong>{resetIn}</strong> (Mon 10AM IST)</p>

        {loading ? (
          <div className="loading-spinner">⏳ Loading scores…</div>
        ) : rows.length === 0 ? (
          <div className="empty-board">
            {supabase
              ? <p>No scores yet this week. Be the first! 🎮</p>
              : <p>⚠️ Supabase not configured.<br/>Set up your .env to see shared scores.</p>
            }
          </div>
        ) : (
          <div className="lb-table">
            <div className="lb-header">
              <span>#</span>
              <span>Player</span>
              <span>Score</span>
              <span>Games</span>
            </div>
            {rows.map((row, i) => (
              <div
                key={row.name}
                className={`lb-row ${row.name.toLowerCase() === player?.name?.toLowerCase() ? 'my-row' : ''}`}
              >
                <span className="lb-rank">{medals[i] || i + 1}</span>
                <span className="lb-name">{row.name} {row.name.toLowerCase() === player?.name?.toLowerCase() ? '(you)' : ''}</span>
                <span className="lb-score">{row.totalScore}</span>
                <span className="lb-games">{row.games}</span>
              </div>
            ))}
          </div>
        )}

        <button className="btn-secondary" onClick={loadLeaderboard} disabled={loading}>
          🔄 Refresh
        </button>
      </div>
    </div>
  )
}
