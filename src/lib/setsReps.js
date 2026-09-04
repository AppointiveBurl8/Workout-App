/**
 * Per-exercise Sets x Reps scheme, configured on the workout template (not the
 * exercise itself, since the same movement can call for a different sets/reps
 * scheme in different workouts). Modeled after the "Sets x Reps" screen in
 * StrongLifts 5x5.
 *
 * @typedef {Object} SetsRepsScheme
 * @property {'straight'|'top_back_off'|'ramp'|'pyramid'|'reverse_pyramid'|'custom'} pattern
 * @property {number} sets
 * @property {number} reps
 * @property {number} percent used by top_back_off ("back-off") and ramp ("set interval")
 * @property {number[]} customSets explicit reps per set, used by pyramid/reverse_pyramid/custom
 */

export const SETS_REPS_PATTERNS = [
  'straight',
  'top_back_off',
  'ramp',
  'pyramid',
  'reverse_pyramid',
  'custom',
]

export const SETS_REPS_PATTERN_LABELS = {
  straight: 'Straight',
  top_back_off: 'Top/Back-off',
  ramp: 'Ramp',
  pyramid: 'Pyramid',
  reverse_pyramid: 'Reverse Pyramid',
  custom: 'Custom',
}

/** Only top_back_off and ramp show the percent row, and each labels it differently. */
export const PERCENT_FIELD_LABEL = {
  top_back_off: 'Back-off',
  ramp: 'Set Interval',
}

export function defaultSetsRepsScheme() {
  return { pattern: 'straight', sets: 3, reps: 10, percent: 10, customSets: [10, 10, 10] }
}

/** Patterns whose sets are an explicit, individually-editable per-set reps table. */
export function usesCustomTable(pattern) {
  return pattern === 'pyramid' || pattern === 'reverse_pyramid' || pattern === 'custom'
}

/** Reasonable starting table when switching into a table-based pattern. Custom keeps
 * whatever table is already there (e.g. arriving from Pyramid) instead of reshaping
 * it, but still reconciles its length to the current Sets count - Sets can have
 * changed via the stepper while a non-table pattern (which doesn't touch the table)
 * was active. */
export function buildTableForPattern(pattern, scheme) {
  const { sets, reps } = scheme
  if (pattern === 'pyramid') {
    return Array.from({ length: sets }, (_, i) => Math.max(1, reps - i * 2))
  }
  if (pattern === 'reverse_pyramid') {
    return Array.from({ length: sets }, (_, i) => Math.max(1, reps - (sets - 1 - i) * 2))
  }
  const existing =
    scheme.customSets && scheme.customSets.length > 0
      ? scheme.customSets
      : Array.from({ length: sets }, () => reps)
  return resizeTable(existing, sets, reps)
}

/** Grows/shrinks a per-set table to match a new Sets count, padding with its last value. */
export function resizeTable(customSets, newSize, fallbackReps) {
  if (newSize <= customSets.length) return customSets.slice(0, newSize)
  const pad = customSets[customSets.length - 1] ?? fallbackReps
  return [...customSets, ...Array.from({ length: newSize - customSets.length }, () => pad)]
}

/** Compact display string for lists/headers - what the old per-exercise repsLabel used to show. */
export function formatSetsReps(scheme) {
  if (!scheme) return ''
  if (usesCustomTable(scheme.pattern)) {
    return scheme.customSets.join('-')
  }
  const base = `${scheme.sets} × ${scheme.reps}`
  if (scheme.pattern === 'top_back_off') return `${base} (-${scheme.percent}% back-off)`
  if (scheme.pattern === 'ramp') return `${base} (+${scheme.percent}%/set)`
  return base
}
