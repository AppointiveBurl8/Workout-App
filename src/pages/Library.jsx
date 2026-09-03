import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import CategoryBadge from '../components/CategoryBadge'
import ExerciseEditor from '../components/ExerciseEditor'
import TemplateCard from '../components/TemplateCard'
import TemplateEditor from '../components/TemplateEditor'
import {
  EXERCISE_CATEGORIES,
  archiveWorkoutTemplate,
  deleteExercise,
  duplicateWorkoutTemplate,
  getExercises,
  getTemplatesUsingExercise,
  getWorkoutTemplates,
} from '../db'
import { CATEGORY_LABELS, CATEGORY_TAB_ACTIVE_CLASSES } from '../lib/categories'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui'

const FILTERS = ['all', ...EXERCISE_CATEGORIES]

function ExerciseCard({ exercise, onEdit, onDelete }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="font-semibold">{exercise.name}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {(exercise.categories ?? []).map((category) => (
          <CategoryBadge key={category} category={category} />
        ))}
        {exercise.repsLabel && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {exercise.repsLabel}
          </span>
        )}
      </div>
      {exercise.notes && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{exercise.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => onEdit(exercise.id)}
        >
          Edit
        </button>
        <button type="button" className={dangerButtonClass} onClick={() => onDelete(exercise)}>
          Delete
        </button>
      </div>
    </div>
  )
}

export default function Library() {
  const [view, setView] = useState('workouts')
  const [filter, setFilter] = useState('all')
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [editingExerciseId, setEditingExerciseId] = useState(null)

  const templates = useLiveQuery(() => getWorkoutTemplates(), [])
  const exercises = useLiveQuery(() => getExercises(), [])

  const visibleTemplates = (templates ?? [])
    .filter((t) => !t.archived)
    .filter((t) => filter === 'all' || t.category === filter)

  const visibleExercises = (exercises ?? []).filter(
    (ex) => filter === 'all' || (ex.categories ?? []).includes(filter),
  )

  const handleDuplicate = async (id) => {
    await duplicateWorkoutTemplate(id)
  }

  const handleArchive = async (id) => {
    const template = (templates ?? []).find((t) => t.id === id)
    if (template && !window.confirm(`Archive "${template.name}"?`)) return
    await archiveWorkoutTemplate(id)
  }

  const handleDeleteExercise = async (exercise) => {
    const using = await getTemplatesUsingExercise(exercise.id)
    const warning = using.length
      ? `\n\nIt's used by ${using.length} workout${using.length === 1 ? '' : 's'} (${using
          .map((t) => t.name)
          .join(', ')}), which will lose this movement.`
      : ''
    if (!window.confirm(`Delete "${exercise.name}"?${warning}`)) return
    await deleteExercise(exercise.id)
  }

  const showingWorkouts = view === 'workouts'
  const loading = showingWorkouts ? templates === undefined : exercises === undefined

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Library</h1>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() =>
            showingWorkouts ? setEditingTemplateId('new') : setEditingExerciseId('new')
          }
        >
          {showingWorkouts ? '+ New Template' : '+ New Exercise'}
        </button>
      </div>

      <div className="flex gap-2 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
        {[
          ['workouts', 'Workouts'],
          ['exercises', 'Exercises'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            aria-pressed={view === value}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-medium ${
              view === value
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f
                ? CATEGORY_TAB_ACTIVE_CLASSES[f]
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            {f === 'all' ? 'All' : CATEGORY_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : showingWorkouts ? (
        visibleTemplates.length === 0 ? (
          <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            No templates here yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={setEditingTemplateId}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
              />
            ))}
          </div>
        )
      ) : visibleExercises.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No exercises here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onEdit={setEditingExerciseId}
              onDelete={handleDeleteExercise}
            />
          ))}
        </div>
      )}

      {editingTemplateId !== null && (
        <TemplateEditor
          editingId={editingTemplateId}
          onClose={() => setEditingTemplateId(null)}
        />
      )}
      {editingExerciseId !== null && (
        <ExerciseEditor
          editingId={editingExerciseId}
          onClose={() => setEditingExerciseId(null)}
        />
      )}
    </div>
  )
}
