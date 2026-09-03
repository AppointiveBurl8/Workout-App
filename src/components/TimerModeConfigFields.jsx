import { PAILS_RAILS_SIDES, SIDE_MODES, TIMER_MODES } from '../db'
import { SIDE_MODE_LABELS, TIMER_MODE_LABELS } from '../lib/categories'
import { inputClass, labelClass } from '../lib/ui'

function NumberField({ id, label, value, min = 0, onChange }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function TimerModePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIMER_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          className={`min-h-11 flex-1 rounded-full px-4 py-2 text-sm font-medium ${
            value === mode
              ? 'bg-indigo-600 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
          }`}
        >
          {TIMER_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  )
}

/**
 * The duration/rounds/side inputs for one timer mode. Shared by the template editor
 * (where they're the workout's saved defaults) and the Start Workout screen (where
 * they're a per-session override), so both stay in step.
 *
 * `config` carries all three mode configs plus sideMode; `onChange` receives a patch.
 */
export default function TimerModeConfigFields({ timerMode, config, onChange, idPrefix }) {
  const { intervalConfig, pailsRailsConfig, openWorkConfig, sideMode } = config

  const patchInterval = (field, value) =>
    onChange({ intervalConfig: { ...intervalConfig, [field]: value } })
  const patchPailsRails = (field, value) =>
    onChange({ pailsRailsConfig: { ...pailsRailsConfig, [field]: value } })
  const patchOpenWork = (field, value) =>
    onChange({ openWorkConfig: { ...openWorkConfig, [field]: value } })

  if (timerMode === 'interval') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          id={`${idPrefix}-iv-work`}
          label="Work (sec)"
          value={intervalConfig.workSeconds}
          onChange={(v) => patchInterval('workSeconds', v)}
        />
        <NumberField
          id={`${idPrefix}-iv-rest`}
          label="Rest (sec)"
          value={intervalConfig.restSeconds}
          onChange={(v) => patchInterval('restSeconds', v)}
        />
        <NumberField
          id={`${idPrefix}-iv-rounds`}
          label="Rounds"
          min={1}
          value={intervalConfig.rounds}
          onChange={(v) => patchInterval('rounds', v)}
        />
      </div>
    )
  }

  if (timerMode === 'pails_rails') {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id={`${idPrefix}-pr-hold`}
            label="Stretch hold (sec)"
            value={pailsRailsConfig.holdSeconds}
            onChange={(v) => patchPailsRails('holdSeconds', v)}
          />
          <NumberField
            id={`${idPrefix}-pr-ramp`}
            label="Ramp (sec)"
            value={pailsRailsConfig.rampSeconds}
            onChange={(v) => patchPailsRails('rampSeconds', v)}
          />
          <NumberField
            id={`${idPrefix}-pr-pails`}
            label="PAILs hold (sec)"
            value={pailsRailsConfig.pailsHoldSeconds}
            onChange={(v) => patchPailsRails('pailsHoldSeconds', v)}
          />
          <NumberField
            id={`${idPrefix}-pr-rails`}
            label="RAILs hold (sec)"
            value={pailsRailsConfig.railsHoldSeconds}
            onChange={(v) => patchPailsRails('railsHoldSeconds', v)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id={`${idPrefix}-pr-rounds`}
            label="Rounds"
            min={1}
            value={pailsRailsConfig.rounds}
            onChange={(v) => patchPailsRails('rounds', v)}
          />
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-pr-side`}>
              Side
            </label>
            <select
              id={`${idPrefix}-pr-side`}
              className={inputClass}
              value={pailsRailsConfig.side}
              onChange={(e) => patchPailsRails('side', e.target.value)}
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
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-ow-target`}>
            Session target (minutes)
          </label>
          <input
            id={`${idPrefix}-ow-target`}
            type="number"
            min="1"
            className={inputClass}
            value={Math.round(openWorkConfig.sessionTargetSeconds / 60)}
            onChange={(e) =>
              patchOpenWork('sessionTargetSeconds', Math.max(1, Number(e.target.value)) * 60)
            }
          />
        </div>
        <NumberField
          id={`${idPrefix}-ow-rest`}
          label="Rest (sec)"
          value={openWorkConfig.restSeconds}
          onChange={(v) => patchOpenWork('restSeconds', v)}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-ow-side-mode`}>
          Side pattern
        </label>
        <select
          id={`${idPrefix}-ow-side-mode`}
          className={inputClass}
          value={sideMode}
          onChange={(e) => onChange({ sideMode: e.target.value })}
        >
          {SIDE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {SIDE_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
