export function defaultExerciseDraft(category) {
  return {
    name: '',
    categories: category ? [category] : [],
    repsLabel: '',
    notes: '',
  }
}

export function toExerciseDraft(exercise) {
  return {
    name: exercise.name ?? '',
    categories: exercise.categories ?? [],
    repsLabel: exercise.repsLabel ?? '',
    notes: exercise.notes ?? '',
  }
}

export function buildExercisePayload(draft) {
  return {
    name: draft.name.trim(),
    categories: draft.categories,
    repsLabel: draft.repsLabel?.trim() ?? '',
    notes: draft.notes?.trim() ?? '',
  }
}
