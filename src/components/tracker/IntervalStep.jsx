import { useReducer } from 'react'
import { usePhaseTransitionCues } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval, useOnceWhen } from '../../lib/useInterval'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

function init(config) {
  return { phase: 'work', round: 1, remainingSeconds: config.workSeconds, done: false }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (state.done) return state
      const { workSeconds, restSeconds, rounds } = action.config
      const remainingSeconds = state.remainingSeconds - 1
      if (remainingSeconds > 0) return { ...state, remainingSeconds }
      if (state.phase === 'work') {
        if (state.round < rounds) {
          return { ...state, phase: 'rest', remainingSeconds: restSeconds }
        }
        return { ...state, done: true, remainingSeconds: 0 }
      }
      return { ...state, phase: 'work', round: state.round + 1, remainingSeconds: workSeconds }
    }
    // Retuning the phase that's currently running shifts what's left of it by the same amount.
    case 'ADJUST_REMAINING':
      return { ...state, remainingSeconds: Math.max(1, state.remainingSeconds + action.delta) }
    case 'CLAMP_ROUND':
      return { ...state, round: Math.min(state.round, action.rounds) }
    default:
      return state
  }
}

export default function IntervalStep({ config, paused, onComplete, onConfigChange }) {
  const [state, dispatch] = useReducer(reducer, config, init)

  useInterval(() => dispatch({ type: 'TICK', config }), paused || state.done ? null : 1000)
  useOnceWhen(state.done, onComplete)
  usePhaseTransitionCues(state.phase, state.round, state.done)

  const setDuration = (field, value) => {
    const runningField = state.phase === 'work' ? 'workSeconds' : 'restSeconds'
    if (field === runningField) {
      dispatch({ type: 'ADJUST_REMAINING', delta: value - config[field] })
    }
    onConfigChange({ ...config, [field]: value })
  }

  const setRounds = (value) => {
    dispatch({ type: 'CLAMP_ROUND', rounds: value })
    onConfigChange({ ...config, rounds: value })
  }

  const phaseTotal = state.phase === 'work' ? config.workSeconds : config.restSeconds

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p
        className={`text-xl font-semibold uppercase tracking-wide ${
          state.phase === 'work'
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {state.phase === 'work' ? 'Work' : 'Rest'}
      </p>
      <p className="text-8xl font-bold tabular-nums">{formatMMSS(state.remainingSeconds)}</p>
      <div className="w-full max-w-xs">
        <ProgressBar value={phaseTotal > 0 ? 1 - state.remainingSeconds / phaseTotal : 1} />
      </div>
      <p className="text-base text-neutral-500 dark:text-neutral-400">
        Round {state.round} of {config.rounds}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Work"
          value={config.workSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => setDuration('workSeconds', v)}
        />
        <AdjustableChip
          label="Rest"
          value={config.restSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          onChange={(v) => setDuration('restSeconds', v)}
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
