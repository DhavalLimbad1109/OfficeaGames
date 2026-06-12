import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 35
const COLORS = [
  'rgba(14,165,233,0.12)',
  'rgba(34,211,238,0.10)',
  'rgba(45,212,191,0.08)',
  'rgba(139,92,246,0.07)',
  'rgba(236,72,153,0.06)',
]

function createParticle(w, h) {
  const size = 2 + Math.random() * 4
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size,
    baseSize: size,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -0.15 - Math.random() * 0.35,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.01 + Math.random() * 0.02,
  }
}

export default function AnimatedBackground() {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const animRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas.width, canvas.height)
    )

    function draw() {
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)

      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.pulse += p.pulseSpeed
        p.size = p.baseSize + Math.sin(p.pulse) * 1.5

        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w }
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20

        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(p.size, 0.5), 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()

        // Soft glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.3})`)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
