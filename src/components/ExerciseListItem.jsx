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
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div>
        <p className="text-sm font-medium">{exercise ? exercise.name : 'Unknown exercise'}</p>
        {exercise && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {showCategory &&
              (exercise.categories ?? []).map((category) => (
                <CategoryBadge key={category} category={category} />
              ))}
            {exercise.repsLabel && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {exercise.repsLabel}
              </span>
            )}
          </div>
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
