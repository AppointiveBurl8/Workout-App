import { useState } from 'react'

export default function AdjustableChip({ label, value, formatValue, step, min, onChange, disabled }) {
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded(true)}
        className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300"
      >
        {label}: {formatValue(value)}
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 py-1 pl-3 pr-1 dark:border-neutral-700">
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium dark:bg-neutral-800"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="min-w-[3ch] text-center text-sm font-medium tabular-nums">
        {formatValue(value)}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium dark:bg-neutral-800"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="rounded-full px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400"
      >
        Done
      </button>
    </div>
  )
}
