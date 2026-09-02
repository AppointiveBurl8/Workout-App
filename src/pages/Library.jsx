import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import TemplateCard from '../components/TemplateCard'
import TemplateEditor from '../components/TemplateEditor'
import { EXERCISE_CATEGORIES, archiveWorkoutTemplate, duplicateWorkoutTemplate, getWorkoutTemplates } from '../db'
import { CATEGORY_LABELS, CATEGORY_TAB_ACTIVE_CLASSES } from '../lib/categories'
import { primaryButtonClass } from '../lib/ui'

const FILTERS = ['all', ...EXERCISE_CATEGORIES]

export default function Library() {
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const templates = useLiveQuery(() => getWorkoutTemplates(), [])

  const visible = (templates ?? [])
    .filter((t) => !t.archived)
    .filter((t) => filter === 'all' || t.category === filter)

  const handleDuplicate = async (id) => {
    await duplicateWorkoutTemplate(id)
  }

  const handleArchive = async (id) => {
    const template = (templates ?? []).find((t) => t.id === id)
    if (template && !window.confirm(`Archive "${template.name}"?`)) return
    await archiveWorkoutTemplate(id)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Library</h1>
        <button type="button" className={primaryButtonClass} onClick={() => setEditingId('new')}>
          + New Template
        </button>
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

      {templates === undefined ? (
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No templates here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={setEditingId}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {editingId !== null && (
        <TemplateEditor editingId={editingId} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}
