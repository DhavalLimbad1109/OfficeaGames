const PLAY_HISTORY_KEY = 'og_play_history'
const WINDOW_MS = 8 * 60 * 60 * 1000 // 8 hours
const MAX_PLAYS = 2
const TESTING_NO_PLAY_LIMIT = true

export function getPlayStatus() {
  const raw = localStorage.getItem(PLAY_HISTORY_KEY)
  const history = raw ? JSON.parse(raw) : []
  const cutoff = Date.now() - WINDOW_MS
  const recent = history.filter(p => p.playedAt > cutoff)

  if (TESTING_NO_PLAY_LIMIT) {
    return { playsRemaining: Number.POSITIVE_INFINITY, nextPlayTime: null, recentCount: recent.length }
  }

  const playsRemaining = Math.max(0, MAX_PLAYS - recent.length)
  const nextPlayTime =
    playsRemaining === 0
      ? new Date(recent[0].playedAt + WINDOW_MS)
      : null

  return { playsRemaining, nextPlayTime, recentCount: recent.length }
}

export function recordPlay(gameType) {
  const raw = localStorage.getItem(PLAY_HISTORY_KEY)
  const history = raw ? JSON.parse(raw) : []
  const cutoff = Date.now() - WINDOW_MS
  const recent = history.filter(p => p.playedAt > cutoff)
  recent.push({ playedAt: Date.now(), gameType })
  localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(recent))
}

export function getLastGameType() {
  return localStorage.getItem('og_last_game') || null
}

export function setLastGameType(gameType) {
  localStorage.setItem('og_last_game', gameType)
}
