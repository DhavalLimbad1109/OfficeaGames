import { useState, useEffect, useCallback } from 'react'
import Timer from '../Timer.jsx'
import { shuffle } from '../../utils/gameUtils.js'
import { getHintPenaltyPerUse } from '../../utils/scoring.js'
import { playCorrect, playWrong } from '../../utils/sounds.js'

export default function WordAssociation({ questions, difficulty, totalTime, onEnd }) {
  const [idx, setIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [answers, setAnswers] = useState([])
  const [ended, setEnded] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [shuffledChoices, setShuffledChoices] = useState([])
  const [hintEliminated, setHintEliminated] = useState(new Set())
  const [hintsUsed, setHintsUsed] = useState(0)

  const q = questions[idx]
  const hintPenaltyPerUse = getHintPenaltyPerUse(difficulty)

  useEffect(() => {
    if (q) {
      setShuffledChoices(shuffle(q.choices))
      setChosen(null)
      setHintEliminated(new Set())
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

  function handleAnswer(choice) {
    if (chosen) return
    const correct = choice === q.answer
    correct ? playCorrect() : playWrong()
    setChosen(choice)
    const newAnswers = [...answers, { correct, timeLeft }]
    setTimeout(() => {
      setAnswers(newAnswers)
      if (idx + 1 >= questions.length) endGame(newAnswers)
      else setIdx(i => i + 1)
    }, 700)
  }

  function useHint() {
    if (chosen || hintEliminated.size > 0) return
    const wrongChoices = shuffledChoices.filter(choice => choice !== q.answer)
    const eliminated = shuffle(wrongChoices).slice(0, 2)
    setHintEliminated(new Set(eliminated))
    setHintsUsed(prev => prev + 1)
  }

  if (!q) return null

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>💭 Word Association</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>
      <div className="game-progress">Question {idx + 1} / {questions.length}</div>

      <div className="game-tools">
        <button className="btn-secondary small" onClick={useHint} disabled={!!chosen || hintEliminated.size > 0}>
          💡 50-50 Hint (-{hintPenaltyPerUse})
        </button>
      </div>

      <div className="word-display">{q.word}</div>
      <p className="question-prompt">Best associated with…</p>

      <div className="options-grid-2x2">
        {shuffledChoices.map(choice => {
          let cls = 'option-btn'
          if (chosen) {
            if (choice === q.answer) cls += ' correct'
            else if (choice === chosen) cls += ' wrong'
            else cls += ' disabled'
          } else if (hintEliminated.has(choice)) {
            cls += ' disabled'
          }
          return (
          <button key={choice} className={cls} onClick={() => handleAnswer(choice)} disabled={!!chosen || hintEliminated.has(choice)}>
            {choice}
          </button>
          )
        })}
      </div>
    </div>
  )
}
