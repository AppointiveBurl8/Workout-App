/**
 * The shape of an exercise as the form works with it, and the shape it is stored
 * in. Free of Dexie and React so both can be reasoned about on their own.
 */

/**
 * An exercise is two-sided unless it explicitly says otherwise. That default is
 * what keeps a pre-v8 row - and a backup file or cloud blob written by an older
 * build - running exactly as it did before the flag existed.
 */
export function normalizeExercise(exercise) {
  return { ...exercise, sided: exercise.sided !== false }
}

export function defaultExerciseDraft(category) {
  return {
    name: '',
    categories: category ? [category] : [],
    sided: true,
    notes: '',
  }
}

export function toExerciseDraft(exercise) {
  return {
    name: exercise.name ?? '',
    categories: exercise.categories ?? [],
    sided: exercise.sided !== false,
    notes: exercise.notes ?? '',
  }
}

export function buildExercisePayload(draft) {
  return {
    name: draft.name.trim(),
    categories: draft.categories,
    sided: draft.sided !== false,
    notes: draft.notes?.trim() ?? '',
  }
}
