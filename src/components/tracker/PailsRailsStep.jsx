import { useReducer } from 'react'
import { usePhaseTransitionCues } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval, useOnceWhen } from '../../lib/useInterval'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

const SWITCH_SECONDS = 3
const DEFAULT_HOLD_SECONDS = 15
const PHASE_LABELS = {
  stretch: 'Stretch Hold',
  ramp: 'Ramp',
  pails: 'PAILs Hold',
  switch: 'Switch',
  rails: 'RAILs Hold',
}

function init(exercise) {
  const cfg = exercise.pailsRails
  const holdSeconds = cfg.holdSeconds ?? DEFAULT_HOLD_SECONDS
  return {
    phase: 'stretch',
    round: 1,
    remainingSeconds: holdSeconds,
    holdSeconds,
    rampSeconds: cfg.rampSeconds,
    pailsHoldSeconds: cfg.pailsHoldSeconds,
    railsHoldSeconds: cfg.railsHoldSeconds,
    rounds: cfg.rounds,
    side: cfg.side,
    done: false,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (state.done) return state
      const remainingSeconds = state.remainingSeconds - 1
      if (remainingSeconds > 0) return { ...state, remainingSeconds }
      if (state.phase === 'stretch') {
        return { ...state, phase: 'ramp', remainingSeconds: state.rampSeconds }
      }
      if (state.phase === 'ramp') {
        return { ...state, phase: 'pails', remainingSeconds: state.pailsHoldSeconds }
      }
      if (state.phase === 'pails') {
        return { ...state, phase: 'switch', remainingSeconds: SWITCH_SECONDS }
      }
      if (state.phase === 'switch') {
        return { ...state, phase: 'rails', remainingSeconds: state.railsHoldSeconds }
      }
      // phase === 'rails' -> round boundary
      if (state.round < state.rounds) {
        return {
          ...state,
          phase: 'stretch',
          round: state.round + 1,
          remainingSeconds: state.holdSeconds,
        }
      }
      return { ...state, done: true, remainingSeconds: 0 }
    }
    case 'SET_HOLD_SECONDS': {
      const delta = action.value - state.holdSeconds
      return {
        ...state,
        holdSeconds: action.value,
        remainingSeconds:
          state.phase === 'stretch' ? Math.max(1, state.remainingSeconds + delta) : state.remainingSeconds,
      }
    }
    case 'SET_RAMP_SECONDS': {
      const delta = action.value - state.rampSeconds
      return {
        ...state,
        rampSeconds: action.value,
        remainingSeconds:
          state.phase === 'ramp' ? Math.max(1, state.remainingSeconds + delta) : state.remainingSeconds,
      }
    }
    case 'SET_PAILS_SECONDS': {
      const delta = action.value - state.pailsHoldSeconds
      return {
        ...state,
        pailsHoldSeconds: action.value,
        remainingSeconds:
          state.phase === 'pails' ? Math.max(1, state.remainingSeconds + delta) : state.remainingSeconds,
      }
    }
    case 'SET_RAILS_SECONDS': {
      const delta = action.value - state.railsHoldSeconds
      return {
        ...state,
        railsHoldSeconds: action.value,
        remainingSeconds:
          state.phase === 'rails' ? Math.max(1, state.remainingSeconds + delta) : state.remainingSeconds,
      }
    }
    case 'SET_ROUNDS':
      return { ...state, rounds: action.value, round: Math.min(state.round, action.value) }
    default:
      return state
  }
}

export default function PailsRailsStep({ exercise, paused, onComplete }) {
  const [state, dispatch] = useReducer(reducer, exercise, init)

  useInterval(() => dispatch({ type: 'TICK' }), paused || state.done ? null : 1000)
  useOnceWhen(state.done, onComplete)
  usePhaseTransitionCues(state.phase, state.round, state.done)

  const phaseTotal = {
    stretch: state.holdSeconds,
    ramp: state.rampSeconds,
    pails: state.pailsHoldSeconds,
    switch: SWITCH_SECONDS,
    rails: state.railsHoldSeconds,
  }[state.phase]

  const activeSide = state.side === 'left_right' ? (state.round % 2 === 1 ? 'left' : 'right') : null

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
        <ProgressBar value={1 - state.remainingSeconds / phaseTotal} colorClassName="bg-emerald-600" />
      </div>
      <p className="text-base text-neutral-500 dark:text-neutral-400">
        Round {state.round} of {state.rounds}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Stretch hold"
          value={state.holdSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => dispatch({ type: 'SET_HOLD_SECONDS', value: v })}
        />
        <AdjustableChip
          label="Ramp"
          value={state.rampSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          onChange={(v) => dispatch({ type: 'SET_RAMP_SECONDS', value: v })}
        />
        <AdjustableChip
          label="PAILs"
          value={state.pailsHoldSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => dispatch({ type: 'SET_PAILS_SECONDS', value: v })}
        />
        <AdjustableChip
          label="RAILs"
          value={state.railsHoldSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => dispatch({ type: 'SET_RAILS_SECONDS', value: v })}
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
