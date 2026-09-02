import { useState } from 'react'
import { addLoggedSession, EXERCISE_CATEGORIES } from '../../db'
import { combineLocalDateWithNow, localDayKey } from '../../lib/dateStats'
import { CATEGORY_LABELS } from '../../lib/categories'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui'

export default function LogEntryForm({ draft, onSaved, onDiscard }) {
  const [date, setDate] = useState(() => localDayKey(new Date()))
  const [category, setCategory] = useState(draft.category)
  const [durationMin, setDurationMin] = useState(() => Math.floor(draft.durationSeconds / 60))
  const [durationSec, setDurationSec] = useState(() => draft.durationSeconds % 60)
  const [setsCompleted, setSetsCompleted] = useState(draft.setsCompleted ?? 0)
  const [rpe, setRpe] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await addLoggedSession({
      date: combineLocalDateWithNow(date),
      templateId: draft.templateId,
      category,
      durationSeconds: Math.max(0, durationMin) * 60 + Math.max(0, Math.min(59, durationSec)),
      setsCompleted: draft.setsCompleted !== null ? setsCompleted : null,
      rpe,
      notes: notes.trim(),
    })
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Log workout</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{draft.workoutName}</p>

      <div>
        <label className={labelClass} htmlFor="log-date">
          Date
        </label>
        <input
          id="log-date"
          type="date"
          className={inputClass}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="log-category">
          Category
        </label>
        <select
          id="log-category"
          className={inputClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {EXERCISE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className={labelClass}>Duration</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            aria-label="Duration minutes"
            className={inputClass}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">min</span>
          <input
            type="number"
            min="0"
            max="59"
            aria-label="Duration seconds"
            className={inputClass}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">sec</span>
        </div>
      </div>

      {draft.setsCompleted !== null && (
        <div>
          <label className={labelClass} htmlFor="log-sets">
            Sets completed
          </label>
          <input
            id="log-sets"
            type="number"
            min="0"
            className={inputClass}
            value={setsCompleted}
            onChange={(e) => setSetsCompleted(Math.max(0, Number(e.target.value)))}
          />
        </div>
      )}

      <div>
        <span className={labelClass}>RPE</span>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRpe(n)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${
                rpe === n
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="log-notes">
          Notes (optional)
        </label>
        <textarea
          id="log-notes"
          rows={3}
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="mt-2 flex gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDiscard} disabled={saving}>
          Discard
        </button>
        <button
          type="button"
          className={`${primaryButtonClass} flex-1`}
          onClick={handleSave}
          disabled={saving}
        >
          Save
        </button>
      </div>
    </div>
  )
}
