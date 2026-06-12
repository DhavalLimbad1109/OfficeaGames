import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import GameScreen from './GameScreen.jsx'
import AchievementToast from './AchievementToast.jsx'
import { calculateFinalScore, DIFFICULTY_CONFIG } from '../utils/scoring.js'
import { playGameEnd } from '../utils/sounds.js'
import { launchConfetti } from '../utils/confetti.js'

export default function DailyChallenge({ player, sessionToken, fingerprint, onBack }) {
  const [challenge, setChallenge] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [hasPlayed, setHasPlayed] = useState(false)
  const [myScore, setMyScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('info')
  const [gameConfig, setGameConfig] = useState(null)
  const [result, setResult] = useState(null)
  const [earnedAchievements, setEarnedAchievements] = useState([])

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadChallenge() }, [])

  async function loadChallenge() {
    setLoading(true)
    try {
      if (!supabase || !sessionToken) { setLoading(false); return }

      const [challengeRes, playedRes, lbRes] = await Promise.all([
        supabase.rpc('get_daily_challenge', { _today: today }),
        supabase.rpc('has_played_daily', { _session_token: sessionToken, _fp_hash: fingerprint, _challenge_date: today }),
        supabase.rpc('get_daily_leaderboard', { _challenge_date: today }),
      ])

      if (challengeRes.data) {
        const ch = Array.isArray(challengeRes.data) ? challengeRes.data[0] : challengeRes.data
        setChallenge(ch)
      }
      setHasPlayed(Boolean(playedRes.data))
      if (lbRes.data) setLeaderboard(lbRes.data)
    } catch (_) {}
    setLoading(false)
  }

  function startChallenge() {
    if (!challenge) return
    const questions = challenge.questions || []
    setGameConfig({
      type: challenge.game_type,
      difficulty: challenge.difficulty || 'medium',
      questions,
      totalTime: DIFFICULTY_CONFIG[challenge.difficulty || 'medium']?.timeSeconds || 90,
    })
    setView('playing')
  }

  const handleGameEnd = useCallback(async (gameOutcome) => {
    const normalized = Array.isArray(gameOutcome)
      ? { answers: gameOutcome, hintsUsed: 0 }
      : { answers: gameOutcome?.answers ?? [], hintsUsed: gameOutcome?.hintsUsed ?? 0 }

    const { answers, hintsUsed } = normalized
    const difficulty = challenge?.difficulty || 'medium'
    const { total, correct, wrong } = calculateFinalScore(answers, difficulty, hintsUsed)
    const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0

    playGameEnd()
    if (accuracy >= 80) launchConfetti()

    setResult({ score: total, correct, wrong, accuracy: Math.round(accuracy) })
    setMyScore(total)
    setHasPlayed(true)
    setView('result')

    if (supabase && sessionToken) {
      try {
        await supabase.rpc('record_daily_score', {
          _session_token: sessionToken,
          _fp_hash: fingerprint,
          _challenge_date: today,
          _score: total,
          _correct: correct,
          _wrong: wrong,
        })
        const lbRes = await supabase.rpc('get_daily_leaderboard', { _challenge_date: today })
        if (lbRes.data) setLeaderboard(lbRes.data)

        // Check achievements
        const totalTime = DIFFICULTY_CONFIG[difficulty]?.timeSeconds || 90
        const timeRemainingPct = answers.length > 0 && answers[answers.length - 1].timeLeft != null
          ? (answers[answers.length - 1].timeLeft / totalTime) * 100 : 0
        const { data: earned } = await supabase.rpc('check_and_award_achievements', {
          _session_token: sessionToken,
          _fp_hash: fingerprint,
          _game_score: total,
          _correct: correct,
          _wrong: wrong,
          _difficulty: difficulty,
          _time_remaining_pct: Math.round(timeRemainingPct),
        })
        if (earned?.length) setEarnedAchievements(earned)
      } catch (_) {}
    }
  }, [challenge, sessionToken, fingerprint, today])

  if (loading) return (
    <div className="screen-center">
      <div className="card"><div className="loading-spinner">⏳ Loading daily challenge...</div></div>
    </div>
  )

  if (view === 'playing' && gameConfig) {
    return <GameScreen config={gameConfig} onEnd={handleGameEnd} onClose={() => setView('info')} />
  }

  const achievementToast = (
    <AchievementToast achievements={earnedAchievements} onDone={() => setEarnedAchievements([])} />
  )

  if (view === 'result' && result) {
    return (
      <>
      {achievementToast}
      <div className="screen-center">
        <div className="card result-card">
          <h2>🌟 Daily Challenge Complete!</h2>
          <div className="result-score-big">{result.score}</div>
          <p className="result-score-label">points</p>
          <div className="result-stats">
            <div className="result-stat">
              <span className="rs-value correct-color">{result.correct}</span>
              <span className="rs-label">Correct</span>
            </div>
            <div className="result-stat">
              <span className="rs-value wrong-color">{result.wrong}</span>
              <span className="rs-label">Wrong</span>
            </div>
            <div className="result-stat">
              <span className="rs-value">{result.accuracy}%</span>
              <span className="rs-label">Accuracy</span>
            </div>
          </div>

          <h3 style={{ marginTop: 16, color: 'var(--primary2)' }}>Today's Leaderboard</h3>
          {leaderboard.length > 0 ? (
            <div className="lb-table" style={{ marginTop: 8 }}>
              {leaderboard.map((row, i) => (
                <div key={row.name} className={`lb-row ${row.name === player?.name ? 'my-row' : ''}`}>
                  <span className="lb-rank">{['🥇','🥈','🥉'][i] || i + 1}</span>
                  <span className="lb-name">{row.name}</span>
                  <span className="lb-score">{row.score}</span>
                  <span className="lb-games"></span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No scores yet today.</p>
          )}

          <button className="btn-secondary" onClick={onBack} style={{ marginTop: 16 }}>← Back to Hub</button>
        </div>
      </div>
      </>
    )
  }

  return (
    <div className="screen-center">
      <div className="card daily-card">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>🌟 Daily Challenge</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 16 }}>
          A new challenge every day. Compete for the top spot!
        </p>

        {!supabase ? (
          <div className="empty-board">⚠️ Supabase required for daily challenges.</div>
        ) : !challenge ? (
          <div className="empty-board">No challenge available today. Check back later!</div>
        ) : hasPlayed ? (
          <div className="daily-played">
            <p>✅ You've already completed today's challenge!</p>
            {myScore !== null && <p className="daily-your-score">Your score: <strong>{myScore}</strong></p>}
          </div>
        ) : (
          <div className="daily-info">
            <div className="daily-meta">
              <span>Game: <strong>{challenge.game_type}</strong></span>
              <span>Difficulty: <strong>{challenge.difficulty || 'medium'}</strong></span>
            </div>
            <button className="btn-play" onClick={startChallenge}>🎯 Start Challenge</button>
          </div>
        )}

        <h3 style={{ marginTop: 20, color: 'var(--primary2)', fontSize: '1rem' }}>Today's Rankings</h3>
        {leaderboard.length > 0 ? (
          <div className="lb-table" style={{ marginTop: 8 }}>
            {leaderboard.map((row, i) => (
              <div key={row.name} className={`lb-row ${row.name === player?.name ? 'my-row' : ''}`}>
                <span className="lb-rank">{['🥇','🥈','🥉'][i] || i + 1}</span>
                <span className="lb-name">{row.name}</span>
                <span className="lb-score">{row.score}</span>
                <span className="lb-games"></span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 8 }}>No scores yet today. Be the first!</p>
        )}
      </div>
    </div>
  )
}
