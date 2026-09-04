import {
  PERCENT_FIELD_LABEL,
  SETS_REPS_PATTERNS,
  SETS_REPS_PATTERN_LABELS,
  buildTableForPattern,
  resizeTable,
  usesCustomTable,
} from '../lib/setsReps'

function StepperRow({ label, value, min, onChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-base font-medium">
        {value} {label}
      </span>
      <div className="inline-flex items-center divide-x divide-neutral-300 overflow-hidden rounded-full bg-neutral-100 dark:divide-neutral-600 dark:bg-neutral-800">
        <button
          type="button"
          className="flex h-9 w-10 items-center justify-center text-lg disabled:opacity-30"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <button
          type="button"
          className="flex h-9 w-10 items-center justify-center text-lg"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

/**
 * Per-exercise Sets x Reps configuration, opened from a template's exercise list.
 * Modeled after StrongLifts 5x5's "Sets x Reps" screen: a Sets/Reps stepper, a
 * pattern picker, and (for the table-based patterns) an editable per-set reps list.
 */
export default function SetsRepsEditor({ exerciseName, scheme, onChange, onClose }) {
  const setSets = (sets) => {
    if (usesCustomTable(scheme.pattern)) {
      onChange({ ...scheme, sets, customSets: resizeTable(scheme.customSets, sets, scheme.reps) })
    } else {
      onChange({ ...scheme, sets })
    }
  }
  const setReps = (reps) => onChange({ ...scheme, reps })
  const setPercent = (percent) => onChange({ ...scheme, percent: Math.max(0, percent) })
  const setPattern = (pattern) => {
    onChange(
      usesCustomTable(pattern)
        ? { ...scheme, pattern, customSets: buildTableForPattern(pattern, scheme) }
        : { ...scheme, pattern },
    )
  }
  const setTableReps = (index, reps) => {
    const customSets = [...scheme.customSets]
    customSets[index] = Math.max(0, reps)
    onChange({ ...scheme, customSets })
  }
  const addSet = () => {
    const last = scheme.customSets[scheme.customSets.length - 1] ?? scheme.reps
    const customSets = [...scheme.customSets, last]
    onChange({ ...scheme, customSets, sets: customSets.length })
  }
  const removeSet = (index) => {
    if (scheme.customSets.length <= 1) return
    const customSets = scheme.customSets.filter((_, i) => i !== index)
    onChange({ ...scheme, customSets, sets: customSets.length })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-900">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-lg dark:bg-neutral-800"
          aria-label="Back"
        >
          ‹
        </button>
        <div>
          <h2 className="text-lg font-semibold">Sets × Reps</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{exerciseName}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!usesCustomTable(scheme.pattern) && (
          <div className="mb-4 divide-y divide-neutral-200 rounded-xl bg-neutral-50 dark:divide-neutral-800 dark:bg-neutral-800/50">
            <StepperRow label="Sets" value={scheme.sets} min={1} onChange={setSets} />
            <StepperRow label="Reps" value={scheme.reps} min={1} onChange={setReps} />
          </div>
        )}

        {PERCENT_FIELD_LABEL[scheme.pattern] && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800/50">
            <span className="text-base font-medium">{PERCENT_FIELD_LABEL[scheme.pattern]}</span>
            <div className="inline-flex items-center gap-3">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-lg dark:bg-neutral-700"
                onClick={() => setPercent(scheme.percent - 5)}
                aria-label="Decrease percent"
              >
                −
              </button>
              <span className="min-w-[3.5ch] text-center text-base tabular-nums">{scheme.percent}%</span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-lg dark:bg-neutral-700"
                onClick={() => setPercent(scheme.percent + 5)}
                aria-label="Increase percent"
              >
                +
              </button>
            </div>
          </div>
        )}

        {usesCustomTable(scheme.pattern) && (
          <div className="mb-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
            <div className="flex justify-between px-4 pt-3 text-sm text-neutral-500 dark:text-neutral-400">
              <span>Sets</span>
              <span>Reps</span>
            </div>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {scheme.customSets.map((reps, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-2">
                  <span className="flex-1 text-base">{i + 1}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-right text-base dark:border-neutral-700 dark:bg-neutral-900"
                    value={reps}
                    onChange={(e) => setTableReps(i, Number(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    disabled={scheme.customSets.length <= 1}
                    className="px-1 text-neutral-400 hover:text-red-600 disabled:opacity-30 dark:hover:text-red-400"
                    aria-label={`Remove set ${i + 1}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addSet}
              className="w-full px-4 py-3 text-left text-sm font-medium text-indigo-600 dark:text-indigo-400"
            >
              Add Set
            </button>
          </div>
        )}

        <div className="divide-y divide-neutral-200 rounded-xl bg-neutral-50 dark:divide-neutral-800 dark:bg-neutral-800/50">
          {SETS_REPS_PATTERNS.map((pattern) => (
            <label key={pattern} className="flex items-center gap-3 px-4 py-3">
              <input
                type="radio"
                name="sets-reps-pattern"
                checked={scheme.pattern === pattern}
                onChange={() => setPattern(pattern)}
                className="h-5 w-5 accent-indigo-600"
              />
              <span className="text-base">{SETS_REPS_PATTERN_LABELS[pattern]}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
