import { GAME_META } from '../utils/gameUtils.js'
import { DIFFICULTY_CONFIG as DC } from '../utils/scoring.js'

export default function GameResult({ result, onPlayAgain, onHub, onLeaderboard, playsRemaining }) {
  const { score, correct, wrong, gameType, difficulty, hintsUsed = 0, hintPenalty = 0 } = result
  const meta = GAME_META[gameType]
  const diffCfg = DC[difficulty]
  const total = correct + wrong
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const grade =
    accuracy >= 90 ? { label: 'Outstanding! 🌟', color: '#ffd700' }
    : accuracy >= 70 ? { label: 'Great job! 🎉', color: '#10b981' }
    : accuracy >= 50 ? { label: 'Good effort! 👍', color: '#4f8ef7' }
    : { label: 'Keep practicing! 💪', color: '#f59e0b' }

  return (
    <div className="screen-center">
      <div className="card result-card">
        <div className="result-game-icon">{meta?.emoji}</div>
        <h2>{meta?.name}</h2>
        <p className="result-grade" style={{ color: grade.color }}>{grade.label}</p>

        <div className="result-score-big">{score}</div>
        <p className="result-score-label">points earned</p>
        {hintsUsed > 0 && (
          <p className="result-hint-penalty">Hint penalty: -{hintPenalty} ({hintsUsed} hint{hintsUsed > 1 ? 's' : ''})</p>
        )}

        <div className="result-stats">
          <div className="result-stat">
            <span className="rs-value correct-color">{correct}</span>
            <span className="rs-label">Correct</span>
          </div>
          <div className="result-stat">
            <span className="rs-value wrong-color">{wrong}</span>
            <span className="rs-label">Wrong</span>
          </div>
          <div className="result-stat">
            <span className="rs-value">{accuracy}%</span>
            <span className="rs-label">Accuracy</span>
          </div>
          <div className="result-stat">
            <span className="rs-value" style={{ color: diffCfg.emoji === '🟢' ? '#10b981' : diffCfg.emoji === '🟡' ? '#f59e0b' : '#ef4444' }}>
              {diffCfg.label}
            </span>
            <span className="rs-label">Difficulty</span>
          </div>
        </div>

        <div className="result-actions">
          {playsRemaining > 0 && (
            <button className="btn-play" onClick={onPlayAgain}>
              🎲 Play Again ({playsRemaining} left)
            </button>
          )}
          <button className="btn-leaderboard" onClick={onLeaderboard}>
            🏆 Leaderboard
          </button>
          <button className="btn-secondary" onClick={onHub}>
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  )
}
