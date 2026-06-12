// Lightweight canvas confetti animation
export function launchConfetti(duration = 2000) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const colors = ['#0ea5e9', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#a855f7', '#ec4899', '#f59e0b']
  const particles = []

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: canvas.width * Math.random(),
      y: -20 - Math.random() * canvas.height * 0.3,
      w: 4 + Math.random() * 6,
      h: 6 + Math.random() * 8,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 1,
    })
  }

  const start = performance.now()

  function frame(now) {
    const elapsed = now - start
    if (elapsed > duration) {
      canvas.remove()
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const fade = elapsed > duration * 0.7 ? 1 - (elapsed - duration * 0.7) / (duration * 0.3) : 1

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1
      p.rot += p.rotV
      p.vx *= 0.99

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = p.opacity * fade
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

// Score popup animation
export function showScorePopup(text, x, y) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = `
    position: fixed; left: ${x}px; top: ${y}px;
    font-size: 1.5rem; font-weight: 800; color: #fbbf24;
    text-shadow: 0 2px 8px rgba(251,191,36,0.5);
    pointer-events: none; z-index: 9998;
    animation: scorePopup 1s ease-out forwards;
    transform: translate(-50%, -50%);
  `
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1000)
}
