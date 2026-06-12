// Web Audio API sound effects - no external files needed
const AudioCtx = window.AudioContext || window.webkitAudioContext
let ctx = null

function getCtx() {
  if (!ctx) ctx = new AudioCtx()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
  try {
    const c = getCtx()
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = volume
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + duration)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
  } catch (_) {}
}

export function playCorrect() {
  playTone(523, 0.1, 'sine', 0.25)
  setTimeout(() => playTone(659, 0.1, 'sine', 0.25), 80)
  setTimeout(() => playTone(784, 0.15, 'sine', 0.25), 160)
}

export function playWrong() {
  playTone(200, 0.15, 'sawtooth', 0.2)
  setTimeout(() => playTone(160, 0.2, 'sawtooth', 0.2), 120)
}

export function playClick() {
  playTone(800, 0.05, 'sine', 0.15)
}

export function playGameStart() {
  playTone(440, 0.1, 'sine', 0.2)
  setTimeout(() => playTone(554, 0.1, 'sine', 0.2), 100)
  setTimeout(() => playTone(659, 0.1, 'sine', 0.2), 200)
  setTimeout(() => playTone(880, 0.2, 'sine', 0.25), 300)
}

export function playGameEnd() {
  playTone(880, 0.15, 'sine', 0.2)
  setTimeout(() => playTone(784, 0.15, 'sine', 0.2), 150)
  setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 300)
  setTimeout(() => playTone(523, 0.3, 'sine', 0.25), 450)
}

export function playAchievement() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.2), i * 120)
  })
}

export function playTick() {
  playTone(1000, 0.03, 'sine', 0.1)
}

export function playMatch() {
  playTone(600, 0.08, 'sine', 0.2)
  setTimeout(() => playTone(900, 0.12, 'sine', 0.25), 80)
}
