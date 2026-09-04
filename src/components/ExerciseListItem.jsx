import { iconButtonClass } from '../lib/ui'
import CategoryBadge from './CategoryBadge'

export default function ExerciseListItem({
  exercise,
  index,
  count,
  onMoveUp,
  onMoveDown,
  onRemove,
  showCategory = false,
  setsRepsSummary,
  onEditSetsReps,
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div>
        <p className="text-sm font-medium">{exercise ? exercise.name : 'Unknown exercise'}</p>
        {exercise && showCategory && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {(exercise.categories ?? []).map((category) => (
              <CategoryBadge key={category} category={category} />
            ))}
          </div>
        )}
        {onEditSetsReps && (
          <button
            type="button"
            onClick={onEditSetsReps}
            className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400"
          >
            Sets × Reps: {setsRepsSummary}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={iconButtonClass}
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          className={iconButtonClass}
          onClick={onMoveDown}
          disabled={index === count - 1}
          aria-label="Move down"
        >
          ↓
        </button>
        <button type="button" className={iconButtonClass} onClick={onRemove} aria-label="Remove">
          ✕
        </button>
      </div>
    </li>
  )
}
