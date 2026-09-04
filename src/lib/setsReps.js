/**
 * Per-exercise Sets x Reps scheme, configured on the workout template (not the
 * exercise itself, since the same movement can call for a different sets/reps
 * scheme in different workouts). Modeled after the "Sets x Reps" screen in
 * StrongLifts 5x5 - but this app has no weight tracking, so every pattern resolves
 * to an actual reps-per-set sequence instead of a flat reps-every-set value with a
 * weight-percentage note.
 *
 * @typedef {Object} SetsRepsScheme
 * @property {'straight'|'top_back_off'|'ramp'|'pyramid'|'reverse_pyramid'|'custom'} pattern
 * @property {number} sets
 * @property {number} reps anchor value: the flat reps (straight), the top set's reps
 *   (top_back_off) or the peak set's reps (ramp), or the seed for pyramid/reverse_pyramid
 * @property {number} percent per-set step for top_back_off ("back-off") and ramp ("set interval")
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
  return { pattern: 'straight', sets: 3, reps: 10, percent: 20, customSets: [10, 10, 10] }
}

/** Patterns whose sets are an explicit, individually hand-editable per-set reps table. */
export function usesCustomTable(pattern) {
  return pattern === 'pyramid' || pattern === 'reverse_pyramid' || pattern === 'custom'
}

/** Patterns whose reps-per-set sequence is computed live from Sets/Reps/Percent
 * rather than hand-edited - shown as a read-only preview, not an editable table. */
export function isFormulaDriven(pattern) {
  return pattern === 'top_back_off' || pattern === 'ramp'
}

const PYRAMID_STEP = 2

/** Starts at `reps` and backs off by `percent` each subsequent set, rounded, never
 * below 1 - e.g. reps=12, percent=30 -> 12, 8, 6, 4. */
function backOffSequence(sets, reps, percent) {
  const seq = [reps]
  for (let i = 1; i < sets; i++) {
    seq.push(Math.max(1, Math.round(seq[i - 1] * (1 - percent / 100))))
  }
  return seq
}

/** Starts at `reps` and climbs by a fixed step each set - e.g. reps=2, sets=4 -> 2, 4, 6, 8. */
function pyramidSequence(sets, reps) {
  return Array.from({ length: sets }, (_, i) => reps + i * PYRAMID_STEP)
}

/** The actual reps-per-set list this scheme resolves to - the single source of
 * truth behind both the display string and the Top/Back-off & Ramp preview list. */
export function getRepsSequence(scheme) {
  switch (scheme.pattern) {
    case 'straight':
      return Array.from({ length: scheme.sets }, () => scheme.reps)
    case 'top_back_off':
      return backOffSequence(scheme.sets, scheme.reps, scheme.percent)
    case 'ramp':
      return backOffSequence(scheme.sets, scheme.reps, scheme.percent).reverse()
    case 'pyramid':
      return pyramidSequence(scheme.sets, scheme.reps)
    case 'reverse_pyramid':
      return pyramidSequence(scheme.sets, scheme.reps).reverse()
    default: // custom
      return scheme.customSets
  }
}

/** Reasonable starting table when switching into a hand-editable pattern. Custom
 * keeps whatever table is already there (e.g. arriving from Pyramid) instead of
 * reshaping it, but still reconciles its length to the current Sets count - Sets
 * can have changed via the stepper while a different pattern was active. */
export function buildTableForPattern(pattern, scheme) {
  if (pattern === 'pyramid') return pyramidSequence(scheme.sets, scheme.reps)
  if (pattern === 'reverse_pyramid') return pyramidSequence(scheme.sets, scheme.reps).reverse()
  const existing =
    scheme.customSets && scheme.customSets.length > 0
      ? scheme.customSets
      : Array.from({ length: scheme.sets }, () => scheme.reps)
  return resizeTable(existing, scheme.sets, scheme.reps)
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
  if (scheme.pattern === 'straight') return `${scheme.sets} × ${scheme.reps}`
  return getRepsSequence(scheme).join('-')
}
