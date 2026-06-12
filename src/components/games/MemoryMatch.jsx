import { useState, useEffect, useCallback, useRef } from 'react'
import Timer from '../Timer.jsx'
import { playMatch, playWrong, playClick } from '../../utils/sounds.js'

const EMOJI_POOL = ['🎮','🎯','🎪','🎨','🎭','🎵','🎸','🎺','🎻','🎬','🏆','🌟','🌈','🎂','🎁','🔮','🎲','🧩','🎰','🎳']
const PAIRS = { easy: 6, medium: 8, hard: 10 }
const COLS = { easy: 4, medium: 4, hard: 5 }

function generateCards(difficulty) {
  const count = PAIRS[difficulty]
  const emojis = [...EMOJI_POOL].sort(() => Math.random() - 0.5).slice(0, count)
  const cards = [...emojis, ...emojis].map((emoji, i) => ({
    id: i, emoji, flipped: false, matched: false,
  }))
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export default function MemoryMatch({ difficulty, totalTime, onEnd }) {
  const [cards, setCards] = useState(() => generateCards(difficulty))
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [answers, setAnswers] = useState([])
  const [ended, setEnded] = useState(false)
  const [flippedIds, setFlippedIds] = useState([])
  const [locked, setLocked] = useState(false)
  const matchCount = useRef(0)
  const endedRef = useRef(false)
  const totalPairs = PAIRS[difficulty]

  const endGame = useCallback((finalAnswers) => {
    if (endedRef.current) return
    endedRef.current = true
    setEnded(true)
    onEnd({ answers: finalAnswers, hintsUsed: 0 })
  }, [onEnd])

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

  function handleFlip(id) {
    if (locked || ended) return
    const card = cards.find(c => c.id === id)
    if (!card || card.flipped || card.matched) return
    if (flippedIds.length === 1 && flippedIds[0] === id) return

    const newCards = cards.map(c => c.id === id ? { ...c, flipped: true } : c)
    setCards(newCards)

    playClick()
    if (flippedIds.length === 0) {
      setFlippedIds([id])
    } else {
      const firstId = flippedIds[0]
      const first = cards.find(c => c.id === firstId)
      const second = card
      setLocked(true)

      if (first.emoji === second.emoji) {
        playMatch()
        const newAnswers = [...answers, { correct: true, timeLeft }]
        setAnswers(newAnswers)
        matchCount.current += 1

        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === firstId || c.id === id ? { ...c, matched: true } : c
          ))
          setFlippedIds([])
          setLocked(false)

          if (matchCount.current >= totalPairs) {
            endGame(newAnswers)
          }
        }, 400)
      } else {
        playWrong()
        const newAnswers = [...answers, { correct: false, timeLeft }]
        setAnswers(newAnswers)

        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === firstId || c.id === id ? { ...c, flipped: false } : c
          ))
          setFlippedIds([])
          setLocked(false)
        }, 800)
      }
    }
  }

  const cols = COLS[difficulty]
  const matched = cards.filter(c => c.matched).length / 2

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>🃏 Memory Match</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>
      <div className="game-progress">Pairs Found: {matched} / {totalPairs}</div>

      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cards.map(card => (
          <button
            key={card.id}
            className={`memory-card ${card.flipped || card.matched ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`}
            onClick={() => handleFlip(card.id)}
            disabled={card.flipped || card.matched || locked}
          >
            <span className="memory-card-front">?</span>
            <span className="memory-card-back">{card.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
