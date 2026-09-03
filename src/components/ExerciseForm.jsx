import { EXERCISE_CATEGORIES } from '../db'
import { CATEGORY_LABELS, CATEGORY_TAB_ACTIVE_CLASSES } from '../lib/categories'
import { inputClass, labelClass } from '../lib/ui'

export default function ExerciseForm({ draft, onChange }) {
  const toggleCategory = (category) => {
    const categories = draft.categories.includes(category)
      ? draft.categories.filter((c) => c !== category)
      : [...draft.categories, category]
    onChange({ ...draft, categories })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass} htmlFor="exercise-name">
          Name
        </label>
        <input
          id="exercise-name"
          type="text"
          className={inputClass}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="e.g. Turkish Get-Up"
        />
      </div>

      <div>
        <span className={labelClass}>Categories</span>
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          Pick every category this movement fits — it can belong to more than one.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_CATEGORIES.map((category) => {
            const selected = draft.categories.includes(category)
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-pressed={selected}
                className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium ${
                  selected
                    ? CATEGORY_TAB_ACTIVE_CLASSES[category]
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="exercise-reps">
          Reps label (optional)
        </label>
        <input
          id="exercise-reps"
          type="text"
          className={inputClass}
          placeholder='e.g. "12 reps"'
          value={draft.repsLabel}
          onChange={(e) => onChange({ ...draft, repsLabel: e.target.value })}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="exercise-notes">
          Notes (optional)
        </label>
        <input
          id="exercise-notes"
          type="text"
          className={inputClass}
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        />
      </div>
    </div>
  )
}
