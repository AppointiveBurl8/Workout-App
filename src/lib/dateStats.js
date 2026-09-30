import { isRestDay } from './loggedSession'

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

/**
 * Local noon of a "YYYY-MM-DD" from a date input. Noon, not midnight, so the
 * stored instant can't fall on the wrong calendar day after a timezone change or
 * a DST shift. Built from local components on purpose - `new Date('2026-09-30')`
 * parses as UTC and lands on the previous day west of Greenwich.
 */
export function dateInputToISO(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

/** Rest days are a streak device, not training - they count towards nothing. */
export function workoutsOnly(sessions) {
  return sessions.filter((s) => !isRestDay(s))
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

/** Workouts since `sinceDate`. Rest days are excluded - they aren't sessions done. */
export function countSince(sessions, sinceDate) {
  return workoutsOnly(sessions).filter((s) => new Date(s.date) >= sinceDate).length
}

/** Total training time, in seconds. Rest days contribute nothing. */
export function totalSecondsSince(sessions, sinceDate) {
  return workoutsOnly(sessions)
    .filter((s) => new Date(s.date) >= sinceDate)
    .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)
}

/** Longest run of consecutive days, counting back from today. */
const MAX_STREAK_LOOKBACK_DAYS = 3660

/**
 * Consecutive days, counting back from today, where a **rest day bridges the
 * streak without adding to it**: a deliberate day off shouldn't reset the count,
 * but it isn't a workout either. Only workout days increment.
 *
 * Today is allowed to be empty - the streak shouldn't read 0 first thing in the
 * morning - but any earlier empty day ends it.
 */
export function currentStreak(sessions, today = new Date()) {
  const workoutDays = new Set()
  const restDays = new Set()
  for (const s of sessions) {
    ;(isRestDay(s) ? restDays : workoutDays).add(localDayKey(s.date))
  }

  let streak = 0
  const cursor = new Date(today)
  cursor.setHours(12, 0, 0, 0)
  for (let i = 0; i < MAX_STREAK_LOOKBACK_DAYS; i++) {
    const key = localDayKey(cursor)
    if (workoutDays.has(key)) {
      streak += 1
    } else if (restDays.has(key)) {
      // Bridges the streak without adding to it.
    } else if (i > 0) {
      break // An empty day ends it; today (i === 0) is allowed to be empty.
    }
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
