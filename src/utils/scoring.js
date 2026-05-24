export const DIFFICULTY_CONFIG = {
  easy:   { basePoints: 10, maxBonus: 10, timeSeconds: 120, label: 'Easy',   emoji: '🟢' },
  medium: { basePoints: 20, maxBonus: 20, timeSeconds: 150, label: 'Medium', emoji: '🟡' },
  hard:   { basePoints: 30, maxBonus: 30, timeSeconds: 180, label: 'Hard',   emoji: '🔴' },
}

export const HINT_PENALTY_PER_USE = {
  easy: 4,
  medium: 6,
  hard: 8,
}

export function getDifficultyFromScore(weeklyScore) {
  if (weeklyScore >= 151) return 'hard'
  if (weeklyScore >= 51) return 'medium'
  return 'easy'
}

export function getHintPenaltyPerUse(difficulty) {
  return HINT_PENALTY_PER_USE[difficulty] ?? 5
}

export function scoreForAnswer(difficulty, isCorrect, timeLeft, totalTime) {
  if (!isCorrect) return -2
  const { basePoints, maxBonus } = DIFFICULTY_CONFIG[difficulty]
  const speedBonus = Math.round((timeLeft / totalTime) * maxBonus)
  return basePoints + speedBonus
}

export function calculateFinalScore(answers, difficulty, hintsUsed = 0) {
  const { timeSeconds } = DIFFICULTY_CONFIG[difficulty]
  let total = 0
  let correct = 0
  let wrong = 0

  for (const a of answers) {
    const pts = scoreForAnswer(difficulty, a.correct, a.timeLeft, timeSeconds)
    total += pts
    if (a.correct) correct++
    else wrong++
  }

  const hintPenalty = getHintPenaltyPerUse(difficulty) * Math.max(0, hintsUsed)
  return { total: Math.max(0, total - hintPenalty), correct, wrong, hintPenalty }
}
