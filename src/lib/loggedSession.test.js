import { describe, expect, it } from 'vitest'
import { isRestDay, normalizeLoggedSession, restSessionFields } from './loggedSession'

describe('normalizeLoggedSession', () => {
  it('leaves a rest day alone', () => {
    expect(normalizeLoggedSession({ type: 'rest', id: 1 }).type).toBe('rest')
  })

  it('leaves a workout alone', () => {
    expect(normalizeLoggedSession({ type: 'workout', id: 1 }).type).toBe('workout')
  })

  it('treats a session with no type as a workout - every pre-v7 row', () => {
    expect(normalizeLoggedSession({ id: 1, durationSeconds: 600 }).type).toBe('workout')
  })

  it('treats an unknown type as a workout rather than trusting it', () => {
    expect(normalizeLoggedSession({ type: 'nap' }).type).toBe('workout')
    expect(normalizeLoggedSession({ type: null }).type).toBe('workout')
    expect(normalizeLoggedSession({ type: 'REST' }).type).toBe('workout')
  })

  it('keeps every other field', () => {
    const row = { id: 7, date: '2026-09-30T16:00:00.000Z', category: 'mobility', rpe: 6, notes: 'x' }
    expect(normalizeLoggedSession(row)).toEqual({ ...row, type: 'workout' })
  })

  it('does not mutate the row it was given', () => {
    const row = { id: 1 }
    normalizeLoggedSession(row)
    expect(row.type).toBeUndefined()
  })
})

describe('restSessionFields', () => {
  it('carries nothing that would read as training', () => {
    const r = restSessionFields('2026-09-30T16:00:00.000Z', 'sore')
    expect(r).toEqual({
      type: 'rest',
      date: '2026-09-30T16:00:00.000Z',
      templateId: null,
      category: null,
      durationSeconds: 0,
      setsCompleted: null,
      rpe: null,
      notes: 'sore',
    })
  })

  it('defaults notes to empty', () => {
    expect(restSessionFields('2026-09-30T16:00:00.000Z').notes).toBe('')
  })
})

describe('isRestDay', () => {
  it('is true only for an explicit rest type', () => {
    expect(isRestDay({ type: 'rest' })).toBe(true)
    expect(isRestDay({ type: 'workout' })).toBe(false)
    expect(isRestDay({})).toBe(false)
    expect(isRestDay(undefined)).toBe(false)
  })
})
