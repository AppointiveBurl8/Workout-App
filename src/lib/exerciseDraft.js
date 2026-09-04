export function defaultExerciseDraft(category) {
  return {
    name: '',
    categories: category ? [category] : [],
    notes: '',
  }
}

export function toExerciseDraft(exercise) {
  return {
    name: exercise.name ?? '',
    categories: exercise.categories ?? [],
    notes: exercise.notes ?? '',
  }
}

export function buildExercisePayload(draft) {
  return {
    name: draft.name.trim(),
    categories: draft.categories,
    notes: draft.notes?.trim() ?? '',
  }
}
