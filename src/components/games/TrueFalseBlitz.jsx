import { useState, useEffect, useCallback } from 'react'
import Timer from '../Timer.jsx'
import { playCorrect, playWrong } from '../../utils/sounds.js'

export default function TrueFalseBlitz({ questions, difficulty, totalTime, onEnd }) {
  const [idx, setIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [answers, setAnswers] = useState([])
  const [ended, setEnded] = useState(false)
  const [chosen, setChosen] = useState(null)

  const q = questions[idx]

  useEffect(() => { setChosen(null) }, [idx])

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

  function handleAnswer(value) {
    if (chosen !== null) return
    const correct = value === q.answer
    correct ? playCorrect() : playWrong()
    setChosen(value)
    const newAnswers = [...answers, { correct, timeLeft }]
    setTimeout(() => {
      setAnswers(newAnswers)
      if (idx + 1 >= questions.length) endGame(newAnswers)
      else setIdx(i => i + 1)
    }, 700)
  }

  if (!q) return null

  function btnClass(value) {
    let cls = `tf-btn ${value ? 'true-btn' : 'false-btn'}`
    if (chosen !== null) {
      if (value === q.answer) cls += ' correct'
      else if (value === chosen) cls += ' wrong'
      else cls += ' disabled'
    }
    return cls
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>⚡ True/False Blitz</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>
      <div className="game-progress">Question {idx + 1} / {questions.length}</div>

      <div className="tf-statement">{q.statement}</div>

      {chosen !== null && (
        <div className={`feedback-banner ${q.answer === chosen ? 'correct' : 'wrong'}`}>
          {q.answer === chosen ? '✅ Correct!' : `❌ Answer: ${q.answer ? 'TRUE' : 'FALSE'}`}
        </div>
      )}

      <div className="tf-buttons">
        <button className={btnClass(true)} onClick={() => handleAnswer(true)} disabled={chosen !== null}>
          ✅ TRUE
        </button>
        <button className={btnClass(false)} onClick={() => handleAnswer(false)} disabled={chosen !== null}>
          ❌ FALSE
        </button>
      </div>
    </div>
  )
}
