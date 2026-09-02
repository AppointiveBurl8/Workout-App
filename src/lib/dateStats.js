/** "YYYY-MM-DD" for a Date or ISO string, using LOCAL date parts (never UTC) so a day never shifts across timezones. */
export function localDayKey(dateOrIso) {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Combines a "YYYY-MM-DD" (from a date input) with the current time-of-day, as a local calendar day. */
export function combineLocalDateWithNow(dateInputValue) {
  const [year, month, day] = dateInputValue.split('-').map(Number)
  const now = new Date()
  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ).toISOString()
}

/** Local midnight of the Monday starting the week containing `date`. */
export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Local midnight of the 1st of the month containing `date`. */
export function startOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function countSince(sessions, sinceDate) {
  return sessions.filter((s) => new Date(s.date) >= sinceDate).length
}

/** Consecutive local days with >=1 session, counting back from today (or yesterday if today has none yet). */
export function computeStreak(sessions) {
  const days = new Set(sessions.map((s) => localDayKey(s.date)))
  if (days.size === 0) return 0

  const cursor = new Date()
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (days.has(localDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function formatDisplayDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
