import { Link } from 'react-router-dom'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui'
import CategoryBadge from './CategoryBadge'

export default function TemplateCard({ template, onEdit, onDuplicate, onArchive }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="font-semibold">{template.name}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={template.category} />
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/tracker?templateId=${template.id}`}
          className={`${primaryButtonClass} text-center`}
        >
          Start
        </Link>
        <button type="button" className={secondaryButtonClass} onClick={() => onEdit(template.id)}>
          Edit
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => onDuplicate(template.id)}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={dangerButtonClass}
          onClick={() => onArchive(template.id)}
        >
          Archive
        </button>
      </div>
    </div>
  )
}
