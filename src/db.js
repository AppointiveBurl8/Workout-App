import Dexie from 'dexie'
import { defaultSetsRepsScheme } from './lib/setsReps'

export const EXERCISE_CATEGORIES = ['kettlebell', 'mobility', 'stretching']
export const TIMER_MODES = ['open_work', 'interval', 'pails_rails']
/** Interval's per-round side split. Pails/Rails is always 'unilateral' - not user-selectable. */
export const INTERVAL_SIDE_MODES = ['bilateral', 'unilateral']
export const SIDE_MODES = ['bilateral', 'blocked', 'alternating']

export const DEFAULT_INTERVAL_CONFIG = {
  workSeconds: 30,
  restSeconds: 15,
  rounds: 5,
  sideMode: 'bilateral',
}
export const DEFAULT_PAILS_RAILS_CONFIG = {
  holdSeconds: 15,
  rampSeconds: 5,
  pailsHoldSeconds: 20,
  railsHoldSeconds: 20,
  rounds: 3,
  // Pails/Rails movements are inherently single-sided - constant, not user-editable.
  sideMode: 'unilateral',
}
export const DEFAULT_OPEN_WORK_CONFIG = {
  sessionTargetSeconds: 1200,
  restSeconds: 120,
  setsReps: defaultSetsRepsScheme(),
}

const CATEGORY_DEFAULT_TIMER_MODE = {
  kettlebell: 'open_work',
  mobility: 'interval',
  stretching: 'pails_rails',
}

/** The mode a workout of this category is normally run in - a starting point, never a lock. */
export function defaultTimerModeForCategory(category) {
  return CATEGORY_DEFAULT_TIMER_MODE[category] ?? 'interval'
}

/**
 * @typedef {Object} IntervalConfig
 * @property {number} workSeconds
 * @property {number} restSeconds
 * @property {number} rounds
 * @property {'bilateral'|'unilateral'} sideMode unilateral inserts a Left/Right side step within each round
 *
 * @typedef {Object} PailsRailsConfig
 * @property {number} holdSeconds initial static stretch hold at end-range, before the ramp
 * @property {number} rampSeconds
 * @property {number} pailsHoldSeconds
 * @property {number} railsHoldSeconds
 * @property {number} rounds
 * @property {'unilateral'} sideMode always unilateral - Pails/Rails movements are single-sided
 *
 * @typedef {Object} OpenWorkConfig
 * @property {number} sessionTargetSeconds hard-stop total session length
 * @property {number} restSeconds rest length after each set
 * @property {import('./lib/setsReps').SetsRepsScheme} setsReps a workout-wide sets/reps
 *   plan, exclusive to Open Work - Interval and Pails/Rails have their own rounds/work/
 *   rest structure instead, so a separate sets/reps scheme would be redundant there
 *
 * @typedef {Object} Exercise
 * A movement, and nothing about how it's timed or how many sets/reps it calls for -
 * both belong to the workout that runs it, so the same movement can be run as
 * intervals one day and open work the next, at a different sets/reps scheme each time.
 * @property {number} [id]
 * @property {string} name
 * @property {Array<'kettlebell'|'mobility'|'stretching'>} categories an exercise can belong to several
 * @property {string} [notes]
 *
 * @typedef {Object} WorkoutTemplate
 * @property {number} [id]
 * @property {string} name
 * @property {'kettlebell'|'mobility'|'stretching'} category
 * @property {string[]} tags target areas, e.g. "hips", "full-body"
 * @property {number[]} exerciseIds ordered Exercise ids in this template
 * @property {boolean} archived soft-delete flag; archived templates are hidden from the main list
 * @property {'open_work'|'interval'|'pails_rails'} defaultTimerMode pre-selected on the Start Workout screen
 * @property {IntervalConfig} intervalConfig applied to every exercise when run as intervals
 * @property {PailsRailsConfig} pailsRailsConfig applied to every exercise when run as Pails/Rails
 * @property {OpenWorkConfig} openWorkConfig used when run as open work
 * @property {'bilateral'|'blocked'|'alternating'} sideMode how the open-work movement list is grouped
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

db.version(2)
  .stores({
    exercises: '++id, name, category, timerMode',
    workoutTemplates: '++id, name, category',
    loggedSessions: '++id, date, templateId, category',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('exercises')
      .toCollection()
      .modify((exercise) => {
        if (
          exercise.timerMode === 'pails_rails' &&
          exercise.pailsRails &&
          exercise.pailsRails.holdSeconds == null
        ) {
          exercise.pailsRails.holdSeconds = 15
        }
      })
  })

// Timer mode and its config move off Exercise and onto WorkoutTemplate, and an
// exercise's single category becomes a list. Templates are migrated first, while the
// old per-exercise configs are still readable, so an existing workout keeps the
// timings it was actually being run with instead of falling back to generic defaults.
db.version(3)
  .stores({
    exercises: '++id, name, *categories',
    workoutTemplates: '++id, name, category',
    loggedSessions: '++id, date, templateId, category',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    const legacyExercises = await tx.table('exercises').toArray()
    const legacyById = new Map(legacyExercises.map((exercise) => [exercise.id, exercise]))

    await tx
      .table('workoutTemplates')
      .toCollection()
      .modify((template) => {
        const referenced = (template.exerciseIds ?? [])
          .map((id) => legacyById.get(id))
          .filter(Boolean)
        const legacyInterval = referenced.find((exercise) => exercise.interval)?.interval
        const legacyPailsRails = referenced.find((exercise) => exercise.pailsRails)?.pailsRails
        const legacyOpenWork = referenced.find((exercise) => exercise.openWork)?.openWork
        const legacyMode = referenced.find((exercise) => exercise.timerMode)?.timerMode

        template.defaultTimerMode =
          template.defaultTimerMode ?? legacyMode ?? defaultTimerModeForCategory(template.category)
        template.intervalConfig = { ...DEFAULT_INTERVAL_CONFIG, ...legacyInterval }
        template.pailsRailsConfig = { ...DEFAULT_PAILS_RAILS_CONFIG, ...legacyPailsRails }
        template.openWorkConfig = {
          sessionTargetSeconds:
            template.sessionTargetSeconds ?? DEFAULT_OPEN_WORK_CONFIG.sessionTargetSeconds,
          restSeconds: legacyOpenWork?.restSeconds ?? DEFAULT_OPEN_WORK_CONFIG.restSeconds,
        }
        template.sideMode = template.sideMode ?? 'bilateral'
        delete template.sessionTargetSeconds
      })

    await tx
      .table('exercises')
      .toCollection()
      .modify((exercise) => {
        exercise.categories =
          exercise.categories ?? (exercise.category ? [exercise.category] : [])
        exercise.repsLabel = exercise.repsLabel ?? exercise.openWork?.repsLabel ?? ''
        delete exercise.category
        delete exercise.timerMode
        delete exercise.openWork
        delete exercise.interval
        delete exercise.pailsRails
      })
  })

// intervalConfig gains sideMode (bilateral/unilateral). pailsRailsConfig's old
// side ('bilateral'/'left_right') enum is replaced by a constant sideMode of
// 'unilateral' - Pails/Rails movements are always single-sided, so the split is no
// longer a per-workout choice; the switch-cue mechanism that already showed
// Left/Right per round is now unconditional.
db.version(4)
  .stores({
    exercises: '++id, name, *categories',
    workoutTemplates: '++id, name, category',
    loggedSessions: '++id, date, templateId, category',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('workoutTemplates')
      .toCollection()
      .modify((template) => {
        if (template.intervalConfig) {
          template.intervalConfig.sideMode = template.intervalConfig.sideMode ?? 'bilateral'
        }
        if (template.pailsRailsConfig) {
          delete template.pailsRailsConfig.side
          template.pailsRailsConfig.sideMode = 'unilateral'
        }
      })
  })

// Reps move off Exercise entirely - sets/reps is a per-workout, per-slot scheme now
// (WorkoutTemplate.setsReps, positionally aligned with exerciseIds), configured on
// the Edit Template page instead of on the exercise itself. Every existing template
// backfills one default scheme per exercise it already has.
db.version(5)
  .stores({
    exercises: '++id, name, *categories',
    workoutTemplates: '++id, name, category',
    loggedSessions: '++id, date, templateId, category',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('workoutTemplates')
      .toCollection()
      .modify((template) => {
        const exerciseIds = template.exerciseIds ?? []
        template.setsReps = exerciseIds.map(
          (_, i) => template.setsReps?.[i] ?? defaultSetsRepsScheme(),
        )
      })

    await tx
      .table('exercises')
      .toCollection()
      .modify((exercise) => {
        delete exercise.repsLabel
      })
  })

// v5's per-exercise-slot setsReps turned out to be the wrong shape: usability
// testing showed one scheme per exercise was confusing to configure and read.
// Sets/Reps becomes a single, workout-wide choice instead - and since Interval and
// Pails/Rails already have their own rounds/work/rest structure, it's exclusive to
// Open Work, living at openWorkConfig.setsReps instead of a top-level array.
db.version(6)
  .stores({
    exercises: '++id, name, *categories',
    workoutTemplates: '++id, name, category',
    loggedSessions: '++id, date, templateId, category',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('workoutTemplates')
      .toCollection()
      .modify((template) => {
        if (template.openWorkConfig) {
          template.openWorkConfig.setsReps =
            template.setsReps?.[0] ?? defaultSetsRepsScheme()
        }
        delete template.setsReps
      })
  })

// ---------------- Exercise ----------------

export async function addExercise(exercise) {
  return db.exercises.add({
    name: '',
    categories: [],
    notes: '',
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

/** Templates that reference this exercise - deleting it would leave a gap in each. */
export async function getTemplatesUsingExercise(exerciseId) {
  const templates = await db.workoutTemplates.toArray()
  return templates.filter((template) => (template.exerciseIds ?? []).includes(exerciseId))
}

// ---------------- WorkoutTemplate ----------------

export async function addWorkoutTemplate(template) {
  const category = template.category ?? EXERCISE_CATEGORIES[0]
  return db.workoutTemplates.add({
    name: '',
    category,
    tags: [],
    exerciseIds: [],
    archived: false,
    defaultTimerMode: defaultTimerModeForCategory(category),
    intervalConfig: { ...DEFAULT_INTERVAL_CONFIG },
    pailsRailsConfig: { ...DEFAULT_PAILS_RAILS_CONFIG },
    openWorkConfig: { ...DEFAULT_OPEN_WORK_CONFIG },
    sideMode: 'bilateral',
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

// ---------------- Settings ----------------

export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row ? row.value : undefined
}

export async function setSetting(key, value) {
  return db.settings.put({ key, value })
}

// ---------------- Backup / Restore ----------------

export async function exportAllData() {
  const [exercises, templates, sessions] = await Promise.all([
    db.exercises.toArray(),
    db.workoutTemplates.toArray(),
    db.loggedSessions.toArray(),
  ])
  return { exportedAt: new Date().toISOString(), exercises, templates, sessions }
}

/** Replaces all data with the given bundle. Ids are preserved so cross-table references (exerciseIds, templateId) stay valid. */
export async function importAllData({ exercises, templates, sessions }) {
  await db.transaction('rw', db.exercises, db.workoutTemplates, db.loggedSessions, async () => {
    await db.exercises.clear()
    await db.workoutTemplates.clear()
    await db.loggedSessions.clear()
    if (exercises.length) await db.exercises.bulkAdd(exercises)
    if (templates.length) await db.workoutTemplates.bulkAdd(templates)
    if (sessions.length) await db.loggedSessions.bulkAdd(sessions)
  })
}
