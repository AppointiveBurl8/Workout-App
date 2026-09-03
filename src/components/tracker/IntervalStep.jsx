import { useReducer } from 'react'
import { usePhaseTransitionCues } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval, useOnceWhen } from '../../lib/useInterval'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

function init(exercise) {
  const cfg = exercise.interval
  return {
    phase: 'work',
    round: 1,
    remainingSeconds: cfg.workSeconds,
    workSeconds: cfg.workSeconds,
    restSeconds: cfg.restSeconds,
    rounds: cfg.rounds,
    done: false,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (state.done) return state
      const remainingSeconds = state.remainingSeconds - 1
      if (remainingSeconds > 0) return { ...state, remainingSeconds }
      if (state.phase === 'work') {
        if (state.round < state.rounds) {
          return { ...state, phase: 'rest', remainingSeconds: state.restSeconds }
        }
        return { ...state, done: true, remainingSeconds: 0 }
      }
      return {
        ...state,
        phase: 'work',
        round: state.round + 1,
        remainingSeconds: state.workSeconds,
      }
    }
    case 'SET_WORK_SECONDS': {
      const delta = action.value - state.workSeconds
      return {
        ...state,
        workSeconds: action.value,
        remainingSeconds:
          state.phase === 'work' ? Math.max(1, state.remainingSeconds + delta) : state.remainingSeconds,
      }
    }
    case 'SET_REST_SECONDS': {
      const delta = action.value - state.restSeconds
      return {
        ...state,
        restSeconds: action.value,
        remainingSeconds:
          state.phase === 'rest' ? Math.max(1, state.remainingSeconds + delta) : state.remainingSeconds,
      }
    }
    case 'SET_ROUNDS':
      return { ...state, rounds: action.value, round: Math.min(state.round, action.value) }
    default:
      return state
  }
}

export default function IntervalStep({ exercise, paused, onComplete }) {
  const [state, dispatch] = useReducer(reducer, exercise, init)

  useInterval(() => dispatch({ type: 'TICK' }), paused || state.done ? null : 1000)
  useOnceWhen(state.done, onComplete)
  usePhaseTransitionCues(state.phase, state.round, state.done)

  const phaseTotal = state.phase === 'work' ? state.workSeconds : state.restSeconds

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
        <ProgressBar value={1 - state.remainingSeconds / phaseTotal} />
      </div>
      <p className="text-base text-neutral-500 dark:text-neutral-400">
        Round {state.round} of {state.rounds}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Work"
          value={state.workSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => dispatch({ type: 'SET_WORK_SECONDS', value: v })}
        />
        <AdjustableChip
          label="Rest"
          value={state.restSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          onChange={(v) => dispatch({ type: 'SET_REST_SECONDS', value: v })}
        />
        <AdjustableChip
          label="Rounds"
          value={state.rounds}
          formatValue={(v) => String(v)}
          step={1}
          min={1}
          onChange={(v) => dispatch({ type: 'SET_ROUNDS', value: v })}
        />
      </div>
    </div>
  )
}
