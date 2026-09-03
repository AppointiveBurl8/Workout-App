import {
  DEFAULT_INTERVAL_CONFIG,
  DEFAULT_OPEN_WORK_CONFIG,
  DEFAULT_PAILS_RAILS_CONFIG,
  defaultTimerModeForCategory,
} from '../db'

/**
 * Everything the Tracker needs to run a session: which timer mode, plus the config for
 * each mode so switching mode on the Start Workout screen never loses the other's values.
 * Built from a template's saved defaults, or from plain defaults for a Builder session.
 */
export function resolveSessionConfig(template, category) {
  return {
    timerMode: template?.defaultTimerMode ?? defaultTimerModeForCategory(category),
    intervalConfig: { ...DEFAULT_INTERVAL_CONFIG, ...template?.intervalConfig },
    pailsRailsConfig: { ...DEFAULT_PAILS_RAILS_CONFIG, ...template?.pailsRailsConfig },
    openWorkConfig: { ...DEFAULT_OPEN_WORK_CONFIG, ...template?.openWorkConfig },
    sideMode: template?.sideMode ?? 'bilateral',
  }
}

/** The category an on-the-fly session gets logged under: whichever one its exercises mostly belong to. */
export function majorityCategory(exercises) {
  const counts = {}
  for (const exercise of exercises) {
    for (const category of exercise.categories ?? []) {
      counts[category] = (counts[category] ?? 0) + 1
    }
  }
  let best = 'kettlebell'
  let bestCount = 0
  for (const [category, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }
  return best
}
