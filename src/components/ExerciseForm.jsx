import { EXERCISE_CATEGORIES, PAILS_RAILS_SIDES, TIMER_MODES } from '../db'
import { CATEGORY_LABELS, TIMER_MODE_LABELS } from '../lib/categories'
import { inputClass, labelClass } from '../lib/ui'

export default function ExerciseForm({ draft, onChange }) {
  const updateMode = (mode, field, value) => {
    onChange({ ...draft, [mode]: { ...draft[mode], [field]: value } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass} htmlFor="exercise-name">
          Name
        </label>
        <input
          id="exercise-name"
          type="text"
          className={inputClass}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="e.g. Turkish Get-Up"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="exercise-category">
            Category
          </label>
          <select
            id="exercise-category"
            className={inputClass}
            value={draft.category}
            onChange={(e) => onChange({ ...draft, category: e.target.value })}
          >
            {EXERCISE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="exercise-timer-mode">
            Timer mode
          </label>
          <select
            id="exercise-timer-mode"
            className={inputClass}
            value={draft.timerMode}
            onChange={(e) => onChange({ ...draft, timerMode: e.target.value })}
          >
            {TIMER_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {TIMER_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {draft.timerMode === 'open_work' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="ow-rest">
              Rest (seconds)
            </label>
            <input
              id="ow-rest"
              type="number"
              min="0"
              className={inputClass}
              value={draft.openWork.restSeconds}
              onChange={(e) => updateMode('openWork', 'restSeconds', Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ow-reps">
              Reps label
            </label>
            <input
              id="ow-reps"
              type="text"
              className={inputClass}
              placeholder='e.g. "12 reps"'
              value={draft.openWork.repsLabel}
              onChange={(e) => updateMode('openWork', 'repsLabel', e.target.value)}
            />
          </div>
        </div>
      )}

      {draft.timerMode === 'interval' && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="iv-work">
              Work (sec)
            </label>
            <input
              id="iv-work"
              type="number"
              min="0"
              className={inputClass}
              value={draft.interval.workSeconds}
              onChange={(e) => updateMode('interval', 'workSeconds', Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="iv-rest">
              Rest (sec)
            </label>
            <input
              id="iv-rest"
              type="number"
              min="0"
              className={inputClass}
              value={draft.interval.restSeconds}
              onChange={(e) => updateMode('interval', 'restSeconds', Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="iv-rounds">
              Rounds
            </label>
            <input
              id="iv-rounds"
              type="number"
              min="1"
              className={inputClass}
              value={draft.interval.rounds}
              onChange={(e) => updateMode('interval', 'rounds', Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {draft.timerMode === 'pails_rails' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass} htmlFor="pr-ramp">
                Ramp (sec)
              </label>
              <input
                id="pr-ramp"
                type="number"
                min="0"
                className={inputClass}
                value={draft.pailsRails.rampSeconds}
                onChange={(e) => updateMode('pailsRails', 'rampSeconds', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pr-pails">
                PAILs hold (sec)
              </label>
              <input
                id="pr-pails"
                type="number"
                min="0"
                className={inputClass}
                value={draft.pailsRails.pailsHoldSeconds}
                onChange={(e) =>
                  updateMode('pailsRails', 'pailsHoldSeconds', Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pr-rails">
                RAILs hold (sec)
              </label>
              <input
                id="pr-rails"
                type="number"
                min="0"
                className={inputClass}
                value={draft.pailsRails.railsHoldSeconds}
                onChange={(e) =>
                  updateMode('pailsRails', 'railsHoldSeconds', Number(e.target.value))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="pr-rounds">
                Rounds
              </label>
              <input
                id="pr-rounds"
                type="number"
                min="1"
                className={inputClass}
                value={draft.pailsRails.rounds}
                onChange={(e) => updateMode('pailsRails', 'rounds', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pr-side">
                Side
              </label>
              <select
                id="pr-side"
                className={inputClass}
                value={draft.pailsRails.side}
                onChange={(e) => updateMode('pailsRails', 'side', e.target.value)}
              >
                {PAILS_RAILS_SIDES.map((side) => (
                  <option key={side} value={side}>
                    {side === 'bilateral' ? 'Bilateral' : 'Left / Right'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="exercise-notes">
          Notes (optional)
        </label>
        <input
          id="exercise-notes"
          type="text"
          className={inputClass}
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        />
      </div>
    </div>
  )
}
