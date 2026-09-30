import { describe, expect, it } from 'vitest'
import {
  countSince,
  currentStreak,
  dateInputToISO,
  localDayKey,
  startOfMonth,
  startOfWeek,
  totalSecondsSince,
} from './dateStats'

/** A workout on a given local day, at an arbitrary time of day. */
const workout = (yyyyMmDd, durationSeconds = 600) => ({
  type: 'workout',
  date: dateInputToISO(yyyyMmDd),
  category: 'mobility',
  durationSeconds,
})

const rest = (yyyyMmDd) => ({
  type: 'rest',
  date: dateInputToISO(yyyyMmDd),
  category: null,
  durationSeconds: 0,
})

/** Local noon on a given day, which is what the streak walks back from. */
const at = (yyyyMmDd) => new Date(dateInputToISO(yyyyMmDd))

describe('the test environment itself', () => {
  it('runs in a zone with DST, or the DST cases below prove nothing', () => {
    const january = new Date(2026, 0, 15).getTimezoneOffset()
    const july = new Date(2026, 6, 15).getTimezoneOffset()
    expect(january).not.toBe(july)
  })
})

describe('dateInputToISO', () => {
  it('round-trips to the same local day', () => {
    for (const day of ['2026-01-01', '2026-06-15', '2026-09-30', '2026-12-31']) {
      expect(localDayKey(dateInputToISO(day))).toBe(day)
    }
  })

  it('round-trips across the spring-forward day, when the clock loses an hour', () => {
    // US DST starts 2026-03-08. Midnight-based storage is what breaks here.
    for (const day of ['2026-03-07', '2026-03-08', '2026-03-09']) {
      expect(localDayKey(dateInputToISO(day))).toBe(day)
    }
  })

  it('round-trips across the fall-back day, when an hour repeats', () => {
    // US DST ends 2026-11-01.
    for (const day of ['2026-10-31', '2026-11-01', '2026-11-02']) {
      expect(localDayKey(dateInputToISO(day))).toBe(day)
    }
  })

  it('lands at local noon, far from either midnight boundary', () => {
    expect(new Date(dateInputToISO('2026-09-30')).getHours()).toBe(12)
  })

  it('does not shift the day the way parsing the string as UTC would', () => {
    // new Date('2026-09-30') is UTC midnight, which is Sep 29 in Eastern.
    expect(localDayKey(new Date('2026-09-30'))).toBe('2026-09-29')
    expect(localDayKey(dateInputToISO('2026-09-30'))).toBe('2026-09-30')
  })
})

describe('currentStreak', () => {
  it('counts consecutive workout days', () => {
    const sessions = [workout('2026-09-28'), workout('2026-09-29'), workout('2026-09-30')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(3)
  })

  it('lets a rest day bridge a gap without adding to the count', () => {
    const sessions = [workout('2026-09-28'), rest('2026-09-29'), workout('2026-09-30')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(2)
  })

  it('lets two rest days in a row bridge', () => {
    const sessions = [
      workout('2026-09-27'),
      rest('2026-09-28'),
      rest('2026-09-29'),
      workout('2026-09-30'),
    ]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(2)
  })

  it('breaks on a day with nothing logged at all', () => {
    const sessions = [workout('2026-09-28'), workout('2026-09-30')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(1)
  })

  it('keeps the streak when today is still empty', () => {
    const sessions = [workout('2026-09-28'), workout('2026-09-29')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(2)
  })

  it('but still breaks if yesterday is empty too', () => {
    const sessions = [workout('2026-09-27')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(0)
  })

  it('keeps the streak when today has only a rest entry', () => {
    const sessions = [workout('2026-09-28'), workout('2026-09-29'), rest('2026-09-30')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(2)
  })

  it('is 0 for a run of rest days with no workout behind them', () => {
    const sessions = [rest('2026-09-28'), rest('2026-09-29'), rest('2026-09-30')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(0)
  })

  it('is 0 with nothing logged', () => {
    expect(currentStreak([], at('2026-09-30'))).toBe(0)
  })

  it('counts a day once however many workouts it holds', () => {
    const sessions = [workout('2026-09-30'), workout('2026-09-30'), workout('2026-09-29')]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(2)
  })

  it('treats a session with no type as a workout', () => {
    const sessions = [{ date: dateInputToISO('2026-09-30'), durationSeconds: 600 }]
    expect(currentStreak(sessions, at('2026-09-30'))).toBe(1)
  })

  it('survives the spring-forward day without losing one', () => {
    const sessions = ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'].map((d) => workout(d))
    expect(currentStreak(sessions, at('2026-03-09'))).toBe(4)
  })

  it('survives the fall-back day without double-counting', () => {
    const sessions = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map((d) => workout(d))
    expect(currentStreak(sessions, at('2026-11-02'))).toBe(4)
  })
})

describe('counts and totals', () => {
  const sessions = [
    workout('2026-09-28', 600),
    rest('2026-09-29'),
    workout('2026-09-30', 900),
    rest('2026-09-30'),
  ]

  it('excludes rest days from a count', () => {
    expect(countSince(sessions, new Date(2026, 8, 1))).toBe(2)
  })

  it('excludes rest days from total time', () => {
    expect(totalSecondsSince(sessions, new Date(2026, 8, 1))).toBe(1500)
  })

  it('counts nothing for a window of only rest days', () => {
    expect(countSince([rest('2026-09-29')], new Date(2026, 8, 1))).toBe(0)
    expect(totalSecondsSince([rest('2026-09-29')], new Date(2026, 8, 1))).toBe(0)
  })

  it('counts a week and a month from the same list', () => {
    // 2026-09-30 is a Wednesday, so the week starts Monday 2026-09-28.
    const week = startOfWeek(at('2026-09-30'))
    const month = startOfMonth(at('2026-09-30'))
    expect(localDayKey(week)).toBe('2026-09-28')
    expect(localDayKey(month)).toBe('2026-09-01')
    expect(countSince(sessions, week)).toBe(2)
    expect(countSince(sessions, month)).toBe(2)
  })
})
