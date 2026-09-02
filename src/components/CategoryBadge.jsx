import { CATEGORY_BADGE_CLASSES, CATEGORY_LABELS } from '../lib/categories'

export default function CategoryBadge({ category }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE_CLASSES[category] ?? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}
