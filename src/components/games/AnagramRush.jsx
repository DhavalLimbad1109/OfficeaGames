import { useState, useEffect, useCallback } from 'react'
import Timer from '../Timer.jsx'
import { scrambleWord } from '../../utils/gameUtils.js'
import { getHintPenaltyPerUse } from '../../utils/scoring.js'
import { playCorrect, playWrong } from '../../utils/sounds.js'

export default function AnagramRush({ questions, difficulty, totalTime, onEnd }) {
  const [idx, setIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [answers, setAnswers] = useState([])
  const [ended, setEnded] = useState(false)
  const [scrambled, setScrambled] = useState([])
  const [selected, setSelected] = useState([])
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'
  const [hintShown, setHintShown] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)

  const q = questions[idx]
  const hintPenaltyPerUse = getHintPenaltyPerUse(difficulty)

  useEffect(() => {
    if (q) {
      const s = scrambleWord(q.word)
      setScrambled(s.split('').map((c, i) => ({ char: c, id: i, used: false })))
      setSelected([])
      setFeedback(null)
      setHintShown(false)
    }
  }, [idx])

  const endGame = useCallback((finalAnswers) => {
    if (ended) return
    setEnded(true)
    onEnd({ answers: finalAnswers, hintsUsed })
  }, [ended, onEnd, hintsUsed])

  useEffect(() => {
    if (ended) return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); endGame(answers); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [ended, answers, endGame])

  function pickLetter(tile) {
    if (tile.used || feedback) return
    const newScrambled = scrambled.map(t => t.id === tile.id ? { ...t, used: true } : t)
    const newSelected = [...selected, tile]
    setScrambled(newScrambled)
    setSelected(newSelected)

    if (newSelected.length === q.word.length) {
      const guess = newSelected.map(t => t.char).join('')
      const correct = guess === q.word
      correct ? playCorrect() : playWrong()
      setFeedback(correct ? 'correct' : 'wrong')
      const newAnswers = [...answers, { correct, timeLeft }]
      setTimeout(() => {
        setAnswers(newAnswers)
        if (idx + 1 >= questions.length) endGame(newAnswers)
        else setIdx(i => i + 1)
      }, 600)
    }
  }

  function removeLetter(tile) {
    if (feedback) return
    setSelected(selected.filter(t => t.id !== tile.id))
    setScrambled(scrambled.map(t => t.id === tile.id ? { ...t, used: false } : t))
  }

  function clearAll() {
    if (feedback) return
    setSelected([])
    setScrambled(scrambled.map(t => ({ ...t, used: false })))
  }

  function useHint() {
    if (hintShown || feedback) return
    setHintShown(true)
    setHintsUsed(prev => prev + 1)
  }

  if (!q) return null

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>🔤 Anagram Rush</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>
      <div className="game-progress">Question {idx + 1} / {questions.length}</div>

      <div className="game-tools">
        <button className="btn-secondary small" onClick={useHint} disabled={hintShown || !!feedback}>
          💡 Show Hint (-{hintPenaltyPerUse})
        </button>
      </div>

      <div className="anagram-hint">{hintShown ? `💡 ${q.hint}` : '💡 Hint hidden — tap "Show Hint" if needed.'}</div>

      <div className={`anagram-answer-row ${feedback || ''}`}>
        {Array.from({ length: q.word.length }).map((_, i) => (
          <div
            key={i}
            className={`letter-tile answer-tile ${selected[i] ? 'filled' : 'empty'}`}
            onClick={() => selected[i] && removeLetter(selected[i])}
          >
            {selected[i]?.char || ''}
          </div>
        ))}
      </div>

      {feedback && (
        <div className={`feedback-banner ${feedback}`}>
          {feedback === 'correct' ? '✅ Correct!' : `❌ Answer: ${q.word}`}
        </div>
      )}

      <div className="anagram-tiles">
        {scrambled.map(tile => (
          <button
            key={tile.id}
            className={`letter-tile pool-tile ${tile.used ? 'used' : ''}`}
            onClick={() => pickLetter(tile)}
            disabled={tile.used || !!feedback}
          >
            {tile.char}
          </button>
        ))}
      </div>

      <button className="btn-secondary small" onClick={clearAll} disabled={!!feedback}>
        🔄 Clear
      </button>
    </div>
  )
}
