import { useState } from 'react'
import { INTERVAL_SIDE_MODES, SIDE_MODES, TIMER_MODES } from '../db'
import { SIDE_MODE_LABELS, TIMER_MODE_LABELS } from '../lib/categories'
import { SETS_REPS_PATTERN_LABELS, formatSetsReps } from '../lib/setsReps'
import { inputClass, labelClass } from '../lib/ui'
import SetsRepsEditor from './SetsRepsEditor'

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
    <div className="grid grid-cols-3 gap-2">
      {TIMER_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={value === mode}
          className={`min-h-11 rounded-full px-2 py-2 text-sm font-medium ${
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
 * `config` carries every mode's config plus sideMode; `onChange` receives a patch.
 */
export default function TimerModeConfigFields({ timerMode, config, onChange, idPrefix }) {
  const { intervalConfig, pailsRailsConfig, openWorkConfig, emomConfig, amrapConfig, sideMode } =
    config
  const [editingSetsReps, setEditingSetsReps] = useState(false)

  const patchInterval = (field, value) =>
    onChange({ intervalConfig: { ...intervalConfig, [field]: value } })
  const patchPailsRails = (field, value) =>
    onChange({ pailsRailsConfig: { ...pailsRailsConfig, [field]: value } })
  const patchOpenWork = (field, value) =>
    onChange({ openWorkConfig: { ...openWorkConfig, [field]: value } })
  const patchEmom = (field, value) => onChange({ emomConfig: { ...emomConfig, [field]: value } })

  if (timerMode === 'emom') {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id={`${idPrefix}-emom-every`}
            label="Every (sec)"
            min={15}
            value={emomConfig.intervalSeconds}
            onChange={(v) => patchEmom('intervalSeconds', v)}
          />
          <NumberField
            id={`${idPrefix}-emom-rounds`}
            label="Rounds"
            min={1}
            value={emomConfig.rounds}
            onChange={(v) => patchEmom('rounds', v)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-emom-side`}>
            Side
          </label>
          <select
            id={`${idPrefix}-emom-side`}
            className={inputClass}
            value={emomConfig.sideMode}
            onChange={(e) => patchEmom('sideMode', e.target.value)}
          >
            {INTERVAL_SIDE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'bilateral' ? 'Bilateral' : 'Unilateral (Left, then Right)'}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          One exercise per interval, in list order. Do the reps; what's left of the
          interval is your rest. A round is one pass through the list.
        </p>
      </div>
    )
  }

  if (timerMode === 'amrap') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-amrap-cap`}>
            Time cap (minutes)
          </label>
          <input
            id={`${idPrefix}-amrap-cap`}
            type="number"
            min="1"
            className={inputClass}
            value={Math.round(amrapConfig.timeCapSeconds / 60)}
            onChange={(e) =>
              onChange({
                amrapConfig: { ...amrapConfig, timeCapSeconds: Math.max(1, Number(e.target.value)) * 60 },
              })
            }
          />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          As many rounds of the list as you can before the cap. Tap Done after each
          movement; the score is logged as rounds completed.
        </p>
      </div>
    )
  }

  if (timerMode === 'interval') {
    return (
      <div className="flex flex-col gap-3">
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
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-iv-side`}>
            Side
          </label>
          <select
            id={`${idPrefix}-iv-side`}
            className={inputClass}
            value={intervalConfig.sideMode}
            onChange={(e) => patchInterval('sideMode', e.target.value)}
          >
            {INTERVAL_SIDE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'bilateral' ? 'Bilateral' : 'Unilateral (Left, then Right)'}
              </option>
            ))}
          </select>
        </div>
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
        <NumberField
          id={`${idPrefix}-pr-rounds`}
          label="Rounds"
          min={1}
          value={pailsRailsConfig.rounds}
          onChange={(v) => patchPailsRails('rounds', v)}
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Runs Left, then Right, every round - Pails/Rails movements are always single-sided.
        </p>
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
      <div>
        <span className={labelClass}>Sets × Reps</span>
        <button
          type="button"
          onClick={() => setEditingSetsReps(true)}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
        >
          {SETS_REPS_PATTERN_LABELS[openWorkConfig.setsReps.pattern]} - {formatSetsReps(openWorkConfig.setsReps)}
        </button>
      </div>
      {editingSetsReps && (
        <SetsRepsEditor
          scheme={openWorkConfig.setsReps}
          onChange={(scheme) => patchOpenWork('setsReps', scheme)}
          onClose={() => setEditingSetsReps(false)}
        />
      )}
    </div>
  )
}
