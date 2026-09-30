import { iconButtonClass } from '../lib/ui'
import CategoryBadge from './CategoryBadge'

export default function ExerciseListItem({
  exercise,
  position,
  onRemove,
  showCategory = false,
  handleProps,
  handleRef,
  itemRef,
  dragging = false,
  style,
}) {
  return (
    <li
      ref={itemRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-white px-2 py-2 dark:bg-neutral-900 ${
        dragging
          ? 'border-indigo-400 shadow-lg dark:border-indigo-500'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      {/* touch-action:none stops the browser scrolling the page instead of dragging. */}
      <button
        type="button"
        ref={handleRef}
        {...handleProps}
        style={{ touchAction: 'none' }}
        className="flex h-11 w-9 shrink-0 cursor-grab items-center justify-center rounded-md text-lg text-neutral-400 hover:bg-neutral-100 active:cursor-grabbing dark:text-neutral-500 dark:hover:bg-neutral-800"
      >
        ⠿
      </button>

      <span className="w-5 shrink-0 text-sm tabular-nums text-neutral-400 dark:text-neutral-500">
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-medium">
            {exercise ? exercise.name : 'Unknown exercise'}
          </p>
          {/* Only the exception is marked. Two-sided is the default and the
              common case, so a chip on every other row would be noise. */}
          {exercise && exercise.sided === false && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              Both sides
            </span>
          )}
        </div>
        {exercise && showCategory && (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {(exercise.categories ?? []).map((category) => (
              <CategoryBadge key={category} category={category} />
            ))}
          </div>
        )}
      </div>

      <button type="button" className={iconButtonClass} onClick={onRemove} aria-label="Remove">
        ✕
      </button>
    </li>
  )
}
