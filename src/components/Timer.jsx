import { useEffect, useState } from 'react'

export default function Timer({ timeLeft, totalTime }) {
  const pct = (timeLeft / totalTime) * 100
  const isWarning = timeLeft <= 30
  const isDanger = timeLeft <= 10

  const color = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')

  return (
    <div className="timer-container">
      <div className="timer-label">
        <span className={`timer-text ${isDanger ? 'pulse' : ''}`} style={{ color }}>
          ⏱ {mins}:{secs}
        </span>
      </div>
      <div className="timer-bar-bg">
        <div
          className="timer-bar-fill"
          style={{ width: `${pct}%`, background: color, transition: 'width 1s linear, background 0.3s' }}
        />
      </div>
    </div>
  )
}
