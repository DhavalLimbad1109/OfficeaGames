import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function PlayerStats({ player, sessionToken, fingerprint, onBack }) {
  const [stats, setStats] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stats')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      if (supabase && sessionToken && fingerprint) {
        const [statsRes, achRes] = await Promise.all([
          supabase.rpc('get_player_stats', { _session_token: sessionToken, _fp_hash: fingerprint }),
          supabase.rpc('get_player_achievements', { _session_token: sessionToken, _fp_hash: fingerprint }),
        ])
        if (statsRes.data) {
          const row = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data
          setStats(row)
        }
        if (achRes.data) setAchievements(achRes.data)
      }
    } catch (_) {}
    setLoading(false)
  }

  return (
    <div className="screen-center">
      <div className="card stats-card">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>📊 Player Stats</h2>
        <p className="stats-player-name">👤 {player?.name}</p>

        <div className="stats-tabs">
          <button className={`stats-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Statistics</button>
          <button className={`stats-tab ${tab === 'achievements' ? 'active' : ''}`} onClick={() => setTab('achievements')}>Achievements</button>
        </div>

        {loading ? (
          <div className="loading-spinner">⏳ Loading...</div>
        ) : tab === 'stats' ? (
          <div className="stats-content">
            {stats ? (
              <>
                <div className="stats-grid">
                  <div className="stats-item">
                    <span className="stats-item-value">{stats.total_games || 0}</span>
                    <span className="stats-item-label">Games Played</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-item-value">{stats.best_score || 0}</span>
                    <span className="stats-item-label">Best Score</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-item-value">{stats.total_correct || 0}</span>
                    <span className="stats-item-label">Correct Answers</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-item-value">{Math.round(stats.accuracy || 0)}%</span>
                    <span className="stats-item-label">Accuracy</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-item-value">{stats.current_streak || 0}</span>
                    <span className="stats-item-label">Current Streak</span>
                  </div>
                  <div className="stats-item">
                    <span className="stats-item-value">{stats.longest_streak || 0}</span>
                    <span className="stats-item-label">Best Streak</span>
                  </div>
                </div>
                {stats.favorite_game && (
                  <div className="stats-favorite">
                    Favorite Game: <strong>{stats.favorite_game}</strong>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-board">No stats yet. Play some games!</div>
            )}
          </div>
        ) : (
          <div className="achievements-grid">
            {achievements.length === 0 ? (
              <div className="empty-board">No achievements available.</div>
            ) : achievements.map(a => (
              <div key={a.achievement_id} className={`achievement-card ${a.earned_at ? 'earned' : 'locked'}`}>
                <span className="achievement-icon">{a.icon || '🏅'}</span>
                <div className="achievement-info">
                  <span className="achievement-name">{a.title}</span>
                  <span className="achievement-desc">{a.description}</span>
                </div>
                {a.earned_at && <span className="achievement-check">✅</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
