/**
 * Shape rules for a logged session, free of Dexie so they can be reasoned about
 * (and tested) without a database.
 *
 * A logged day is either a workout or a **rest day**. Rest days exist for one
 * purpose: to bridge a streak across a deliberate day off. They carry no
 * duration, category or sets, and count towards nothing - see specs/07-log.md.
 */

export const LOGGED_SESSION_TYPES = ['workout', 'rest']

export function isRestDay(session) {
  return session?.type === 'rest'
}

/**
 * A session from outside this build - an old backup file, or a cloud blob
 * written by a device that predates rest days - may have no `type` at all, or a
 * value this build doesn't know. Anything not explicitly 'rest' is a workout,
 * which is what every pre-v7 row was.
 */
export function normalizeLoggedSession(session) {
  return { ...session, type: session.type === 'rest' ? 'rest' : 'workout' }
}

/** A rest day: a date, optional notes, and nothing that would read as training. */
export function restSessionFields(date, notes = '') {
  return {
    type: 'rest',
    date,
    templateId: null,
    category: null,
    durationSeconds: 0,
    setsCompleted: null,
    rpe: null,
    notes,
  }
}
