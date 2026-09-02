import { useMemo, useState } from 'react'
import { addExercise } from '../db'
import { buildExercisePayload, defaultExerciseDraft } from '../lib/exerciseDraft'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui'
import ExerciseForm from './ExerciseForm'

export default function ExercisePicker({ exercises, category, onAdd }) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(() => defaultExerciseDraft(category))

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises
      .filter((ex) => !category || ex.category === category)
      .filter((ex) => !q || ex.name.toLowerCase().includes(q))
  }, [exercises, category, query])

  const startCreating = () => {
    setDraft({ ...defaultExerciseDraft(category), name: query.trim() })
    setCreating(true)
  }

  const saveNewExercise = async () => {
    if (!draft.name.trim()) return
    const id = await addExercise(buildExercisePayload(draft))
    onAdd(id)
    setQuery('')
    setCreating(false)
  }

  const pick = (exercise) => {
    onAdd(exercise.id)
    setQuery('')
  }

  if (creating) {
    return (
      <div className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          New exercise
        </p>
        <ExerciseForm draft={draft} onChange={setDraft} />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => setCreating(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={saveNewExercise}
            disabled={!draft.name.trim()}
          >
            Add exercise
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        className={inputClass}
        placeholder="Search exercises…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        {matches.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => pick(ex)}
            className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
          >
            {ex.name}
          </button>
        ))}
        {matches.length === 0 && (
          <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
            No matching exercises
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={startCreating}
        className="mt-2 block w-full rounded-md border border-dashed border-indigo-300 px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950"
      >
        + Create new exercise{query.trim() ? ` "${query.trim()}"` : ''}
      </button>
    </div>
  )
}
