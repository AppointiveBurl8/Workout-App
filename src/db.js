import Dexie from 'dexie'

export const EXERCISE_CATEGORIES = ['kettlebell', 'mobility', 'stretching']
export const TIMER_MODES = ['open_work', 'interval', 'pails_rails']
export const PAILS_RAILS_SIDES = ['bilateral', 'left_right']

/**
 * @typedef {Object} OpenWorkConfig
 * @property {number} restSeconds
 * @property {string} repsLabel free-text display only (e.g. "12 reps"), not tracked/counted
 *
 * @typedef {Object} IntervalConfig
 * @property {number} workSeconds
 * @property {number} restSeconds
 * @property {number} rounds
 *
 * @typedef {Object} PailsRailsConfig
 * @property {number} rampSeconds
 * @property {number} pailsHoldSeconds
 * @property {number} railsHoldSeconds
 * @property {number} rounds
 * @property {'bilateral'|'left_right'} side
 *
 * @typedef {Object} Exercise
 * @property {number} [id]
 * @property {string} name
 * @property {'kettlebell'|'mobility'|'stretching'} category
 * @property {'open_work'|'interval'|'pails_rails'} timerMode
 * @property {string} [notes]
 * @property {OpenWorkConfig|null} openWork populated only when timerMode is 'open_work'
 * @property {IntervalConfig|null} interval populated only when timerMode is 'interval'
 * @property {PailsRailsConfig|null} pailsRails populated only when timerMode is 'pails_rails'
 *
 * @typedef {Object} WorkoutTemplate
 * @property {number} [id]
 * @property {string} name
 * @property {'kettlebell'|'mobility'|'stretching'} category
 * @property {string[]} tags target areas, e.g. "hips", "full-body"
 * @property {number|null} sessionTargetSeconds hard-stop total session length; only meaningful for kettlebell/open_work templates
 * @property {number[]} exerciseIds ordered Exercise ids in this template
 * @property {boolean} archived soft-delete flag; archived templates are hidden from the main list
 *
 * @typedef {Object} LoggedSession
 * @property {number} [id]
 * @property {string} date ISO string
 * @property {number|null} templateId null if this was an on-the-fly session
 * @property {'kettlebell'|'mobility'|'stretching'} category
 * @property {number} durationSeconds
 * @property {number|null} setsCompleted relevant for open_work sessions
 * @property {number|null} rpe 1-10
 * @property {string} [notes]
 */

export const db = new Dexie('WorkoutTrackerDB')

db.version(1).stores({
  exercises: '++id, name, category, timerMode',
  workoutTemplates: '++id, name, category',
  loggedSessions: '++id, date, templateId, category',
})

// ---------------- Exercise ----------------

export async function addExercise(exercise) {
  return db.exercises.add({
    name: '',
    notes: '',
    openWork: null,
    interval: null,
    pailsRails: null,
    ...exercise,
  })
}

export async function getExercises() {
  return db.exercises.toArray()
}

export async function getExercise(id) {
  return db.exercises.get(id)
}

export async function updateExercise(id, changes) {
  return db.exercises.update(id, changes)
}

export async function deleteExercise(id) {
  return db.exercises.delete(id)
}

// ---------------- WorkoutTemplate ----------------

export async function addWorkoutTemplate(template) {
  return db.workoutTemplates.add({
    name: '',
    tags: [],
    sessionTargetSeconds: null,
    exerciseIds: [],
    archived: false,
    ...template,
  })
}

export async function getWorkoutTemplates() {
  return db.workoutTemplates.toArray()
}

export async function getWorkoutTemplate(id) {
  return db.workoutTemplates.get(id)
}

export async function updateWorkoutTemplate(id, changes) {
  return db.workoutTemplates.update(id, changes)
}

export async function deleteWorkoutTemplate(id) {
  return db.workoutTemplates.delete(id)
}

export async function archiveWorkoutTemplate(id) {
  return db.workoutTemplates.update(id, { archived: true })
}

export async function duplicateWorkoutTemplate(id) {
  const source = await db.workoutTemplates.get(id)
  if (!source) return undefined
  const { id: _sourceId, ...rest } = source
  return addWorkoutTemplate({ ...rest, name: `${source.name} (copy)`, archived: false })
}

// ---------------- LoggedSession ----------------

export async function addLoggedSession(session) {
  return db.loggedSessions.add({
    date: new Date().toISOString(),
    templateId: null,
    setsCompleted: null,
    rpe: null,
    notes: '',
    ...session,
  })
}

export async function getLoggedSessions() {
  return db.loggedSessions.toArray()
}

export async function getLoggedSession(id) {
  return db.loggedSessions.get(id)
}

export async function updateLoggedSession(id, changes) {
  return db.loggedSessions.update(id, changes)
}

export async function deleteLoggedSession(id) {
  return db.loggedSessions.delete(id)
}
