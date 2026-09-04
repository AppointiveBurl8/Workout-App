import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import {
  EXERCISE_CATEGORIES,
  addWorkoutTemplate,
  defaultTimerModeForCategory,
  getExercises,
  getWorkoutTemplate,
  updateWorkoutTemplate,
} from '../db'
import { CATEGORY_LABELS } from '../lib/categories'
import { resolveSessionConfig } from '../lib/sessionConfig'
import { defaultSetsRepsScheme, formatSetsReps } from '../lib/setsReps'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui'
import ExerciseListItem from './ExerciseListItem'
import ExercisePicker from './ExercisePicker'
import SetsRepsEditor from './SetsRepsEditor'
import TimerModeConfigFields, { TimerModePicker } from './TimerModeConfigFields'

function defaultTemplateDraft(exerciseIds = []) {
  const category = EXERCISE_CATEGORIES[0]
  return {
    name: '',
    category,
    tags: [],
    exerciseIds,
    setsReps: exerciseIds.map(() => defaultSetsRepsScheme()),
    archived: false,
    ...resolveSessionConfig(null, category),
  }
}

function toDraft(template) {
  const { timerMode, ...configs } = resolveSessionConfig(template, template.category)
  const exerciseIds = template.exerciseIds ?? []
  return {
    name: template.name,
    category: template.category,
    tags: template.tags ?? [],
    exerciseIds,
    setsReps: exerciseIds.map((_, i) => template.setsReps?.[i] ?? defaultSetsRepsScheme()),
    archived: template.archived ?? false,
    timerMode,
    ...configs,
  }
}

function TagInput({ tags, onChange }) {
  const [text, setText] = useState('')

  const commit = () => {
    const value = text.trim()
    if (value && !tags.includes(value)) {
      onChange([...tags, value])
    }
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        className={inputClass}
        placeholder="Add a tag and press Enter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </div>
  )
}

export default function TemplateEditor({ editingId, initialExerciseIds = [], onClose }) {
  const [draft, setDraft] = useState(
    editingId === 'new' ? defaultTemplateDraft(initialExerciseIds) : null,
  )
  const [modeTouched, setModeTouched] = useState(false)
  const [editingSetsRepsIndex, setEditingSetsRepsIndex] = useState(null)
  const exercises = useLiveQuery(() => getExercises(), [])
  const exercisesById = useMemo(
    () => new Map((exercises ?? []).map((ex) => [ex.id, ex])),
    [exercises],
  )

  useEffect(() => {
    if (editingId === 'new') return
    let cancelled = false
    getWorkoutTemplate(editingId).then((template) => {
      if (!cancelled && template) setDraft(toDraft(template))
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

  const moveExercise = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= draft.exerciseIds.length) return
    const newIds = [...draft.exerciseIds]
    const newSetsReps = [...draft.setsReps]
    ;[newIds[index], newIds[target]] = [newIds[target], newIds[index]]
    ;[newSetsReps[index], newSetsReps[target]] = [newSetsReps[target], newSetsReps[index]]
    setDraft({ ...draft, exerciseIds: newIds, setsReps: newSetsReps })
  }

  const removeExercise = (index) => {
    setDraft({
      ...draft,
      exerciseIds: draft.exerciseIds.filter((_, i) => i !== index),
      setsReps: draft.setsReps.filter((_, i) => i !== index),
    })
  }

  const addExerciseId = (id) => {
    setDraft({
      ...draft,
      exerciseIds: [...draft.exerciseIds, id],
      setsReps: [...draft.setsReps, defaultSetsRepsScheme()],
    })
  }

  const setExerciseSetsReps = (index, scheme) => {
    const setsReps = [...draft.setsReps]
    setsReps[index] = scheme
    setDraft({ ...draft, setsReps })
  }

  const canSave = draft.name.trim().length > 0

  const handleSave = async () => {
    if (!canSave) return
    const payload = {
      name: draft.name.trim(),
      category: draft.category,
      tags: draft.tags,
      exerciseIds: draft.exerciseIds,
      setsReps: draft.setsReps,
      archived: draft.archived,
      defaultTimerMode: draft.timerMode,
      intervalConfig: draft.intervalConfig,
      pailsRailsConfig: draft.pailsRailsConfig,
      openWorkConfig: draft.openWorkConfig,
      sideMode: draft.sideMode,
    }
    if (editingId === 'new') {
      await addWorkoutTemplate(payload)
    } else {
      await updateWorkoutTemplate(editingId, payload)
    }
    onClose(true)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">
          {editingId === 'new' ? 'New Template' : 'Edit Template'}
        </h2>
        <button type="button" onClick={() => onClose(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass} htmlFor="template-name">
              Name
            </label>
            <input
              id="template-name"
              type="text"
              className={inputClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Full Body Kettlebell Complex"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="template-category">
              Category
            </label>
            <select
              id="template-category"
              className={inputClass}
              value={draft.category}
              onChange={(e) => {
                const category = e.target.value
                // A new template's mode follows its category until the user picks one.
                setDraft({
                  ...draft,
                  category,
                  timerMode:
                    editingId === 'new' && !modeTouched
                      ? defaultTimerModeForCategory(category)
                      : draft.timerMode,
                })
              }}
            >
              {EXERCISE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Tags</label>
            <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
          </div>

          <div>
            <span className={labelClass}>Default timer mode</span>
            <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              How this workout is normally run. You can still change it for a single
              session when you start it.
            </p>
            <TimerModePicker
              value={draft.timerMode}
              onChange={(timerMode) => {
                setModeTouched(true)
                setDraft({ ...draft, timerMode })
              }}
            />
            <div className="mt-3">
              <TimerModeConfigFields
                timerMode={draft.timerMode}
                config={draft}
                onChange={(patch) => setDraft({ ...draft, ...patch })}
                idPrefix="tpl"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Exercises</label>
            {draft.exerciseIds.length > 0 ? (
              <ol className="mt-2 flex flex-col gap-2">
                {draft.exerciseIds.map((id, index) => (
                  <ExerciseListItem
                    key={`${id}-${index}`}
                    exercise={exercisesById.get(id)}
                    index={index}
                    count={draft.exerciseIds.length}
                    onMoveUp={() => moveExercise(index, -1)}
                    onMoveDown={() => moveExercise(index, 1)}
                    onRemove={() => removeExercise(index)}
                    setsRepsSummary={formatSetsReps(draft.setsReps[index])}
                    onEditSetsReps={() => setEditingSetsRepsIndex(index)}
                  />
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                No exercises added yet.
              </p>
            )}

            <div className="mt-3">
              <ExercisePicker
                exercises={exercises ?? []}
                category={draft.category}
                onAdd={addExerciseId}
              />
            </div>
          </div>
        </div>
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
          Save Template
        </button>
      </footer>

      {editingSetsRepsIndex !== null && (
        <SetsRepsEditor
          exerciseName={exercisesById.get(draft.exerciseIds[editingSetsRepsIndex])?.name ?? 'Exercise'}
          scheme={draft.setsReps[editingSetsRepsIndex]}
          onChange={(scheme) => setExerciseSetsReps(editingSetsRepsIndex, scheme)}
          onClose={() => setEditingSetsRepsIndex(null)}
        />
      )}
    </div>
  )
}
