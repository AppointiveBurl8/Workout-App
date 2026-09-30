import { useEffect, useRef, useState } from 'react'
import {
  EXERCISE_CATEGORIES,
  addLoggedSession,
  deleteLoggedSession,
  updateLoggedSession,
} from '../../db'
import { restSessionFields } from '../../lib/loggedSession'
import { CATEGORY_LABELS } from '../../lib/categories'
import { combineLocalDateWithNow, dateInputToISO, localDayKey } from '../../lib/dateStats'
import {
  dangerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../lib/ui'

/** Long enough to be a deliberate second tap, short enough not to stay armed. */
const DELETE_CONFIRM_MS = 4000

/** Sets completed only ever meant anything for Open Work, the kettlebell default. */
function categoryTracksSets(category) {
  return category === 'kettlebell'
}

function initialForm(mode, draft, session) {
  if (mode === 'edit') {
    return {
      type: session.type === 'rest' ? 'rest' : 'workout',
      date: localDayKey(session.date),
      category: session.category ?? '',
      durationMin: Math.floor((session.durationSeconds ?? 0) / 60),
      durationSec: (session.durationSeconds ?? 0) % 60,
      setsCompleted: session.setsCompleted ?? 0,
      rpe: session.rpe ?? null,
      notes: session.notes ?? '',
    }
  }
  if (mode === 'post-workout') {
    return {
      type: 'workout',
      date: localDayKey(new Date()),
      category: draft.category,
      durationMin: Math.floor(draft.durationSeconds / 60),
      durationSec: draft.durationSeconds % 60,
      setsCompleted: draft.setsCompleted ?? 0,
      rpe: null,
      notes: '',
    }
  }
  // Category starts unset on purpose: a silently pre-picked one would mis-file
  // an entry, and a wrong category is invisible until the stats look wrong.
  return {
    type: 'workout',
    date: localDayKey(new Date()),
    category: '',
    durationMin: 0,
    durationSec: 0,
    setsCompleted: 0,
    rpe: null,
    notes: '',
  }
}

function validate(form, sessions, editingId) {
  if (!form.date) return 'Pick a date.'
  if (form.date > localDayKey(new Date())) return 'That date is in the future.'

  const sameDay = sessions.filter(
    (s) => s.id !== editingId && localDayKey(s.date) === form.date,
  )

  if (form.type === 'rest') {
    if (sameDay.some((s) => s.type !== 'rest')) {
      return 'There’s already a workout logged that day, so it isn’t a rest day.'
    }
    if (sameDay.some((s) => s.type === 'rest')) {
      return 'That day is already logged as a rest day.'
    }
    return null
  }

  if (!form.category) return 'Pick a category.'
  if (form.durationMin < 0 || form.durationSec < 0) return 'Duration can’t be negative.'
  if (form.rpe !== null && (form.rpe < 1 || form.rpe > 10)) return 'RPE runs from 1 to 10.'
  return null
}

/**
 * Stored instant for the saved entry. Manual and rest entries land on local noon
 * so they can't drift onto the neighbouring day; an edit that leaves the day
 * alone keeps its original timestamp rather than resetting it to noon.
 */
function isoForSave(form, mode, session) {
  if (mode === 'edit' && localDayKey(session.date) === form.date) return session.date
  if (mode === 'post-workout') return combineLocalDateWithNow(form.date)
  return dateInputToISO(form.date)
}

const TYPE_OPTIONS = [
  ['workout', 'Workout'],
  ['rest', 'Rest day'],
]

/**
 * One form, three jobs: the post-workout hand-off from the Tracker (unchanged),
 * adding an entry by hand, and editing or deleting an existing one. Kept as a
 * single component so the three can't drift apart in what they accept.
 */
export default function LogEntryForm({
  mode = 'post-workout',
  draft,
  session,
  sessions = [],
  onSaved,
  onDiscard,
}) {
  const [form, setForm] = useState(() => initialForm(mode, draft, session))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const disarmRef = useRef(null)

  useEffect(() => () => clearTimeout(disarmRef.current), [])

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const isRest = form.type === 'rest'
  const showSets =
    !isRest &&
    (mode === 'post-workout'
      ? draft.setsCompleted !== null
      : (mode === 'edit' && session.setsCompleted != null) || categoryTracksSets(form.category))

  const handleSave = async () => {
    const problem = validate(form, sessions, session?.id)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    const date = isoForSave(form, mode, session)
    const payload = isRest
      ? restSessionFields(date, form.notes.trim())
      : {
          type: 'workout',
          date,
          templateId: mode === 'post-workout' ? draft.templateId : (session?.templateId ?? null),
          category: form.category,
          durationSeconds:
            Math.max(0, form.durationMin) * 60 + Math.max(0, Math.min(59, form.durationSec)),
          setsCompleted: showSets ? Math.max(0, form.setsCompleted) : null,
          rpe: form.rpe,
          notes: form.notes.trim(),
        }

    if (mode === 'edit') {
      await updateLoggedSession(session.id, payload)
    } else {
      await addLoggedSession(payload)
    }
    onSaved()
  }

  // Two taps, because there is no undo. The label carries the warning rather
  // than a dialog, which is easier to dismiss by accident on a phone.
  const handleDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true)
      disarmRef.current = setTimeout(() => setDeleteArmed(false), DELETE_CONFIRM_MS)
      return
    }
    clearTimeout(disarmRef.current)
    setSaving(true)
    await deleteLoggedSession(session.id)
    onSaved()
  }

  const fields = (
    <div className="flex flex-col gap-4">
      {mode === 'add' && (
        <div className="flex gap-2" role="group" aria-label="Entry type">
          {TYPE_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('type', value)}
              aria-pressed={form.type === value}
              className={`min-h-11 flex-1 rounded-md text-base font-medium ${
                form.type === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'post-workout' && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{draft.workoutName}</p>
      )}

      {mode === 'edit' && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {isRest ? 'Rest day' : 'Workout'}
        </p>
      )}

      <div>
        <label className={labelClass} htmlFor="log-date">
          Date
        </label>
        <input
          id="log-date"
          type="date"
          max={localDayKey(new Date())}
          className={inputClass}
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>

      {!isRest && (
        <>
          <div>
            <label className={labelClass} htmlFor="log-category">
              Category
            </label>
            <select
              id="log-category"
              className={inputClass}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">Choose a category…</option>
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
                value={form.durationMin}
                onChange={(e) => set('durationMin', Number(e.target.value))}
              />
              <span className="text-sm text-neutral-500 dark:text-neutral-400">min</span>
              <input
                type="number"
                min="0"
                max="59"
                aria-label="Duration seconds"
                className={inputClass}
                value={form.durationSec}
                onChange={(e) => set('durationSec', Number(e.target.value))}
              />
              <span className="text-sm text-neutral-500 dark:text-neutral-400">sec</span>
            </div>
          </div>

          {showSets && (
            <div>
              <label className={labelClass} htmlFor="log-sets">
                Sets completed
              </label>
              <input
                id="log-sets"
                type="number"
                min="0"
                className={inputClass}
                value={form.setsCompleted}
                onChange={(e) => set('setsCompleted', Math.max(0, Number(e.target.value)))}
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
                  aria-pressed={form.rpe === n}
                  // Tapping the selected number clears it - RPE is optional and
                  // there would otherwise be no way back to "not recorded".
                  onClick={() => set('rpe', form.rpe === n ? null : n)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${
                    form.rpe === n
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <label className={labelClass} htmlFor="log-notes">
          Notes (optional)
        </label>
        <textarea
          id="log-notes"
          rows={3}
          className={inputClass}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )

  // The post-workout hand-off arrives as a full page from the Tracker, so it
  // stays in the page flow; add and edit are overlays over the Log.
  if (mode === 'post-workout') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">Log workout</h1>
        {fields}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onDiscard}
            disabled={saving}
          >
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

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">{mode === 'add' ? 'Add entry' : 'Edit entry'}</h2>
        <button type="button" onClick={onDiscard} className={secondaryButtonClass}>
          Cancel
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {fields}

        {mode === 'edit' && (
          <div className="mt-8 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <button
              type="button"
              className={`${dangerButtonClass} w-full`}
              onClick={handleDelete}
              disabled={saving}
            >
              {deleteArmed ? 'Tap again to delete' : 'Delete entry'}
            </button>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Deleting can’t be undone.
            </p>
          </div>
        )}
      </div>

      <footer
        className="border-t border-neutral-200 px-4 pt-3 dark:border-neutral-800"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          className={`${primaryButtonClass} w-full`}
          onClick={handleSave}
          disabled={saving}
        >
          {mode === 'add' ? 'Save entry' : 'Save changes'}
        </button>
      </footer>
    </div>
  )
}
