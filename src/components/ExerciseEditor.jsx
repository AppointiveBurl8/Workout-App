import { useEffect, useState } from 'react'
import { addExercise, getExercise, updateExercise } from '../db'
import { buildExercisePayload, defaultExerciseDraft, toExerciseDraft } from '../lib/exerciseDraft'
import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'
import ExerciseForm from './ExerciseForm'

export default function ExerciseEditor({ editingId, onClose }) {
  const [draft, setDraft] = useState(editingId === 'new' ? defaultExerciseDraft() : null)

  useEffect(() => {
    if (editingId === 'new') return
    let cancelled = false
    getExercise(editingId).then((exercise) => {
      if (!cancelled && exercise) setDraft(toExerciseDraft(exercise))
    })
    return () => {
      cancelled = true
    }
  }, [editingId])

  if (!draft) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-white dark:bg-neutral-900">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </div>
    )
  }

  const canSave = draft.name.trim().length > 0

  const handleSave = async () => {
    if (!canSave) return
    const payload = buildExercisePayload(draft)
    if (editingId === 'new') {
      await addExercise(payload)
    } else {
      // Templates only store exercise ids, so an edit here shows up in every
      // workout that references this movement without touching those templates.
      await updateExercise(editingId, payload)
    }
    onClose(true)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">
          {editingId === 'new' ? 'New Exercise' : 'Edit Exercise'}
        </h2>
        <button type="button" onClick={() => onClose(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ExerciseForm draft={draft} onChange={setDraft} />
      </div>

      <footer
        className="border-t border-neutral-200 px-4 pt-3 dark:border-neutral-800"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          className={`${primaryButtonClass} w-full`}
          onClick={handleSave}
          disabled={!canSave}
        >
          Save Exercise
        </button>
      </footer>
    </div>
  )
}
