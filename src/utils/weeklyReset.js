const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // UTC+5:30

function toIST(date) {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000 + IST_OFFSET_MS)
}

export function getWeekStart() {
  const ist = toIST(new Date())
  const day = ist.getDay()   // 0=Sun, 1=Mon
  const hour = ist.getHours()

  // Days since last Monday 10:00 AM IST
  let dayOffset = day === 0 ? 6 : day - 1
  if (day === 1 && hour < 10) dayOffset = 7 // before Monday 10am = previous week's Monday

  const weekStartIST = new Date(ist)
  weekStartIST.setDate(ist.getDate() - dayOffset)
  weekStartIST.setHours(10, 0, 0, 0)

  return weekStartIST.toISOString().split('T')[0]
}

export function getNextResetIST() {
  const ist = toIST(new Date())
  const day = ist.getDay()
  const hour = ist.getHours()

  let daysUntil
  if (day === 1 && hour < 10) {
    daysUntil = 0 // this Monday before 10am
  } else if (day === 1) {
    daysUntil = 7 // next Monday
  } else {
    daysUntil = day === 0 ? 1 : 8 - day
  }

  const next = new Date(ist)
  next.setDate(ist.getDate() + daysUntil)
  next.setHours(10, 0, 0, 0)

  // Convert back to local time
  return new Date(next.getTime() - ist.getTimezoneOffset() * 60000 - IST_OFFSET_MS)
}

export function formatCountdown(targetDate) {
  const diff = targetDate - new Date()
  if (diff <= 0) return 'Resetting now…'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
