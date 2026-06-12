import { useState, useEffect } from 'react'
import { playAchievement } from '../utils/sounds.js'

export default function AchievementToast({ achievements, onDone }) {
  const [visible, setVisible] = useState([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!achievements?.length) return
    setCurrent(0)
    setVisible([0])
    playAchievement()
  }, [achievements])

  useEffect(() => {
    if (!achievements?.length) return
    if (current >= achievements.length - 1) {
      const timer = setTimeout(() => {
        setVisible([])
        onDone?.()
      }, 3500)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => {
      const next = current + 1
      setCurrent(next)
      setVisible(prev => [...prev, next])
      playAchievement()
    }, 1200)
    return () => clearTimeout(timer)
  }, [current, achievements, onDone])

  if (!achievements?.length || visible.length === 0) return null

  return (
    <div className="achievement-toast-container">
      {visible.map(i => (
        <div key={achievements[i].achievement_id} className="achievement-toast">
          <span className="achievement-toast-icon">{achievements[i].icon}</span>
          <div className="achievement-toast-text">
            <span className="achievement-toast-label">Achievement Unlocked!</span>
            <span className="achievement-toast-title">{achievements[i].title}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
