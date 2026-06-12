import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function AdminDashboard({ adminUsername, adminPassword }) {
  const [stats, setStats] = useState(null)
  const [topPlayers, setTopPlayers] = useState([])
  const [questionStats, setQuestionStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const [statsRes, playersRes, qStatsRes] = await Promise.all([
        supabase.rpc('admin_get_stats', { _admin_username: adminUsername, _admin_password: adminPassword }),
        supabase.rpc('admin_get_top_players', { _admin_username: adminUsername, _admin_password: adminPassword, _limit: 10 }),
        supabase.rpc('admin_get_question_stats', { _admin_username: adminUsername, _admin_password: adminPassword }),
      ])
      if (statsRes.data) {
        const row = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data
        setStats(row)
      }
      if (playersRes.data) setTopPlayers(playersRes.data)
      if (qStatsRes.data) setQuestionStats(qStatsRes.data)
    } catch (_) {}
    setLoading(false)
  }

  if (loading) return <div className="loading-spinner">⏳ Loading dashboard...</div>

  return (
    <div className="admin-dashboard">
      <h3 className="admin-section-title">📊 Overview</h3>
      {stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <span className="admin-stat-value">{stats.total_players || 0}</span>
            <span className="admin-stat-label">Players</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-value">{stats.total_games_played || 0}</span>
            <span className="admin-stat-label">Games Played</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-value">{stats.total_questions || 0}</span>
            <span className="admin-stat-label">Questions</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-value">{stats.games_today || 0}</span>
            <span className="admin-stat-label">Games Today</span>
          </div>
        </div>
      )}

      <h3 className="admin-section-title">🏆 Top Players</h3>
      {topPlayers.length > 0 ? (
        <div className="admin-top-list">
          {topPlayers.map((p, i) => (
            <div key={p.player_name} className="admin-top-item">
              <span className="admin-top-rank">{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
              <span className="admin-top-name">{p.player_name}</span>
              <span className="admin-top-score">{p.total_score} pts</span>
              <span className="admin-top-games">{p.total_games} games</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="qm-empty">No player data yet.</p>
      )}

      <h3 className="admin-section-title">📝 Question Pool Health</h3>
      {questionStats.length > 0 ? (
        <div className="admin-q-stats">
          {questionStats.map(qs => (
            <div key={`${qs.game_type}-${qs.difficulty}`} className="admin-q-stat-row">
              <span className="admin-q-game">{qs.game_type}</span>
              <span className="admin-q-diff">{qs.difficulty}</span>
              <span className="admin-q-count">{qs.total_count} Qs</span>
              <span className="admin-q-accuracy">{qs.active_count} active</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="qm-empty">No question stats yet.</p>
      )}

      <button className="btn-secondary small" onClick={loadStats} style={{ marginTop: 12 }}>🔄 Refresh</button>
    </div>
  )
}
