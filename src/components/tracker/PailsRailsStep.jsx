import { useReducer } from 'react'
import { usePhaseTransitionCues } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval, useOnceWhen } from '../../lib/useInterval'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

const SWITCH_SECONDS = 3
const PHASE_LABELS = {
  stretch: 'Stretch Hold',
  ramp: 'Ramp',
  pails: 'PAILs Hold',
  switch: 'Switch',
  rails: 'RAILs Hold',
}
/** Which config duration each phase is counting down, so a chip edit can adjust the phase in flight. */
const PHASE_CONFIG_FIELD = {
  stretch: 'holdSeconds',
  ramp: 'rampSeconds',
  pails: 'pailsHoldSeconds',
  rails: 'railsHoldSeconds',
}

function init(config) {
  return { phase: 'stretch', round: 1, remainingSeconds: config.holdSeconds, done: false }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (state.done) return state
      const { holdSeconds, rampSeconds, pailsHoldSeconds, railsHoldSeconds, rounds } = action.config
      const remainingSeconds = state.remainingSeconds - 1
      if (remainingSeconds > 0) return { ...state, remainingSeconds }
      if (state.phase === 'stretch') {
        return { ...state, phase: 'ramp', remainingSeconds: rampSeconds }
      }
      if (state.phase === 'ramp') {
        return { ...state, phase: 'pails', remainingSeconds: pailsHoldSeconds }
      }
      if (state.phase === 'pails') {
        return { ...state, phase: 'switch', remainingSeconds: SWITCH_SECONDS }
      }
      if (state.phase === 'switch') {
        return { ...state, phase: 'rails', remainingSeconds: railsHoldSeconds }
      }
      // phase === 'rails' -> round boundary
      if (state.round < rounds) {
        return { ...state, phase: 'stretch', round: state.round + 1, remainingSeconds: holdSeconds }
      }
      return { ...state, done: true, remainingSeconds: 0 }
    }
    case 'ADJUST_REMAINING':
      return { ...state, remainingSeconds: Math.max(1, state.remainingSeconds + action.delta) }
    case 'CLAMP_ROUND':
      return { ...state, round: Math.min(state.round, action.rounds) }
    default:
      return state
  }
}

export default function PailsRailsStep({ config, paused, onComplete, onConfigChange }) {
  const [state, dispatch] = useReducer(reducer, config, init)

  useInterval(() => dispatch({ type: 'TICK', config }), paused || state.done ? null : 1000)
  useOnceWhen(state.done, onComplete)
  usePhaseTransitionCues(state.phase, state.round, state.done)

  const setDuration = (field, value) => {
    if (field === PHASE_CONFIG_FIELD[state.phase]) {
      dispatch({ type: 'ADJUST_REMAINING', delta: value - config[field] })
    }
    onConfigChange({ ...config, [field]: value })
  }

  const setRounds = (value) => {
    dispatch({ type: 'CLAMP_ROUND', rounds: value })
    onConfigChange({ ...config, rounds: value })
  }

  const phaseTotal =
    state.phase === 'switch' ? SWITCH_SECONDS : config[PHASE_CONFIG_FIELD[state.phase]]

  const activeSide =
    config.side === 'left_right' ? (state.round % 2 === 1 ? 'left' : 'right') : null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-xl font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
        {PHASE_LABELS[state.phase]}
      </p>
      {activeSide && (
        <p className="-mt-4 text-base font-medium text-neutral-600 dark:text-neutral-300">
          {activeSide === 'left' ? 'Left side' : 'Right side'}
        </p>
      )}
      <p className="text-8xl font-bold tabular-nums">{formatMMSS(state.remainingSeconds)}</p>
      <div className="w-full max-w-xs">
        <ProgressBar
          value={phaseTotal > 0 ? 1 - state.remainingSeconds / phaseTotal : 1}
          colorClassName="bg-emerald-600"
        />
      </div>
      <p className="text-base text-neutral-500 dark:text-neutral-400">
        Round {state.round} of {config.rounds}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Stretch hold"
          value={config.holdSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => setDuration('holdSeconds', v)}
        />
        <AdjustableChip
          label="Ramp"
          value={config.rampSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          onChange={(v) => setDuration('rampSeconds', v)}
        />
        <AdjustableChip
          label="PAILs"
          value={config.pailsHoldSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => setDuration('pailsHoldSeconds', v)}
        />
        <AdjustableChip
          label="RAILs"
          value={config.railsHoldSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => setDuration('railsHoldSeconds', v)}
        />
        <AdjustableChip
          label="Rounds"
          value={config.rounds}
          formatValue={(v) => String(v)}
          step={1}
          min={1}
          onChange={setRounds}
        />
      </div>
    </div>
  )
}
