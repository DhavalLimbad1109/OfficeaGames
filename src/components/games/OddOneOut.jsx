import { useState, useEffect, useCallback } from 'react'
import Timer from '../Timer.jsx'
import { shuffle } from '../../utils/gameUtils.js'
import { playCorrect, playWrong } from '../../utils/sounds.js'

export default function OddOneOut({ questions, difficulty, totalTime, onEnd }) {
  const [idx, setIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [answers, setAnswers] = useState([])
  const [ended, setEnded] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [shuffledOptions, setShuffledOptions] = useState([])

  const q = questions[idx]

  useEffect(() => {
    if (q) {
      setShuffledOptions(shuffle(q.options || q.items))
      setChosen(null)
    }
  }, [idx])

  const endGame = useCallback((finalAnswers) => {
    if (ended) return
    setEnded(true)
    onEnd({ answers: finalAnswers, hintsUsed: 0 })
  }, [ended, onEnd])

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

  function handleAnswer(option) {
    if (chosen) return
    const correct = option === q.answer
    correct ? playCorrect() : playWrong()
    setChosen(option)
    const newAnswers = [...answers, { correct, timeLeft }]
    setTimeout(() => {
      setAnswers(newAnswers)
      if (idx + 1 >= questions.length) endGame(newAnswers)
      else setIdx(i => i + 1)
    }, 700)
  }

  if (!q) return null

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>🔍 Odd One Out</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>
      <div className="game-progress">Question {idx + 1} / {questions.length}</div>

      <div className="question-box">
        <p>Which one does <strong>NOT</strong> belong?</p>
        <p className="hint-text">💡 {q.hint}</p>
      </div>

      <div className="options-grid-2x2">
        {shuffledOptions.map(opt => {
          let cls = 'option-btn'
          if (chosen) {
            if (opt === q.answer) cls += ' correct'
            else if (opt === chosen) cls += ' wrong'
            else cls += ' disabled'
          }
          return (
            <button key={opt} className={cls} onClick={() => handleAnswer(opt)} disabled={!!chosen}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
