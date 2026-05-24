export async function generateFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.language || '',
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    navigator.maxTouchPoints || 0,
    navigator.platform || '',
  ]

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = '14px Arial'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f60'
    ctx.fillRect(120, 1, 60, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('OfficeGames', 2, 15)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('OfficeGames', 4, 17)
    components.push(canvas.toDataURL())
  } catch (e) {
    // canvas fingerprinting not available
  }

  const raw = components.join('|||')
  const encoded = new TextEncoder().encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
