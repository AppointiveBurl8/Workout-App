import { EXERCISE_CATEGORIES } from '../db'

export function defaultExerciseDraft(category = EXERCISE_CATEGORIES[0]) {
  return {
    name: '',
    category,
    timerMode: 'interval',
    notes: '',
    openWork: { restSeconds: 30, repsLabel: '' },
    interval: { workSeconds: 30, restSeconds: 15, rounds: 5 },
    pailsRails: {
      holdSeconds: 15,
      rampSeconds: 5,
      pailsHoldSeconds: 20,
      railsHoldSeconds: 20,
      rounds: 3,
      side: 'bilateral',
    },
  }
}

export function buildExercisePayload(draft) {
  return {
    name: draft.name.trim(),
    category: draft.category,
    timerMode: draft.timerMode,
    notes: draft.notes?.trim() ?? '',
    openWork: draft.timerMode === 'open_work' ? draft.openWork : null,
    interval: draft.timerMode === 'interval' ? draft.interval : null,
    pailsRails: draft.timerMode === 'pails_rails' ? draft.pailsRails : null,
  }
}
