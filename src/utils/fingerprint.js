async function getSystemProfile() {
  const uaData = navigator.userAgentData
  const components = [
    navigator.platform || '',
    navigator.language || '',
    [...(navigator.languages || [])].sort().join(','),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || ''),
    String(navigator.deviceMemory || ''),
    String(navigator.maxTouchPoints || 0),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    `${screen.availWidth}x${screen.availHeight}`,
    String(window.devicePixelRatio || 1),
    String(uaData?.mobile ?? /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')),
    uaData?.platform || '',
  ]

  if (uaData?.getHighEntropyValues) {
    try {
      const values = await uaData.getHighEntropyValues([
        'architecture',
        'bitness',
        'model',
        'platformVersion',
        'wow64',
      ])
      components.push(
        values.architecture || '',
        values.bitness || '',
        values.model || '',
        values.platformVersion || '',
        String(values.wow64 || false),
      )
    } catch {
      components.push('ua-data-blocked')
    }
  }

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      components.push(String(vendor || ''), String(renderer || ''))
    }
  } catch {
    components.push('webgl-unavailable')
  }

  return components.join('|||').toLowerCase()
}

export async function generateFingerprint() {
  const raw = await getSystemProfile()
  const encoded = new TextEncoder().encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
