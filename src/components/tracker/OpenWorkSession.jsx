import { useEffect, useReducer, useRef, useState } from 'react'
import { playTone } from '../../lib/audioCues'
import { SIDE_MODE_LABELS } from '../../lib/categories'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval, useOnceWhen } from '../../lib/useInterval'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

function init() {
  return {
    phase: 'work', // 'work' | 'rest' | 'complete'
    workElapsedSeconds: 0,
    restRemainingSeconds: 0,
    sessionElapsedSeconds: 0,
    setsCompleted: 0,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (state.phase === 'complete') return state
      const { sessionTargetSeconds } = action.config
      const sessionElapsedSeconds = state.sessionElapsedSeconds + 1
      if (sessionElapsedSeconds >= sessionTargetSeconds) {
        return { ...state, phase: 'complete', sessionElapsedSeconds: sessionTargetSeconds }
      }
      if (state.phase === 'work') {
        return { ...state, sessionElapsedSeconds, workElapsedSeconds: state.workElapsedSeconds + 1 }
      }
      const restRemainingSeconds = state.restRemainingSeconds - 1
      if (restRemainingSeconds <= 0) {
        return {
          ...state,
          sessionElapsedSeconds,
          phase: 'work',
          workElapsedSeconds: 0,
          restRemainingSeconds: 0,
        }
      }
      return { ...state, sessionElapsedSeconds, restRemainingSeconds }
    }
    case 'END_SET': {
      if (state.phase !== 'work') return state
      return {
        ...state,
        phase: 'rest',
        restRemainingSeconds: action.restSeconds,
        setsCompleted: state.setsCompleted + 1,
      }
    }
    case 'ADJUST_REST_REMAINING':
      return { ...state, restRemainingSeconds: Math.max(1, state.restRemainingSeconds + action.delta) }
    case 'SET_SETS_COMPLETED':
      return { ...state, setsCompleted: Math.max(0, action.value) }
    default:
      return state
  }
}

function MovementRow({ exercise, detail }) {
  return (
    <li className="rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-base font-medium">{exercise.name}</p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>
    </li>
  )
}

/**
 * The informational reference list - purely a display grouping. Open Work never tracks
 * individual movements, so all three patterns just change how the same list reads.
 */
function MovementReference({ exercises, sideMode }) {
  if (sideMode === 'blocked') {
    return (
      <div className="flex flex-col gap-4">
        {['Left side', 'Right side'].map((heading) => (
          <div key={heading}>
            <p className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {heading}
            </p>
            <ul className="flex flex-col gap-2">
              {exercises.map((ex) => (
                <MovementRow key={ex.id} exercise={ex} detail={ex.repsLabel || '—'} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  if (sideMode === 'alternating') {
    return (
      <ul className="flex flex-col gap-2">
        {exercises.map((ex) => (
          <MovementRow
            key={ex.id}
            exercise={ex}
            detail={
              ex.repsLabel ? `${ex.repsLabel} left, then ${ex.repsLabel} right` : 'Left, then right'
            }
          />
        ))}
      </ul>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((ex) => (
        <MovementRow key={ex.id} exercise={ex} detail={ex.repsLabel || '—'} />
      ))}
    </ul>
  )
}

export default function OpenWorkSession({ exercises, config, sideMode, onConfigChange, onEnd }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const [paused, setPaused] = useState(false)
  const complete = state.phase === 'complete'
  const prevPhaseRef = useRef(state.phase)

  useInterval(() => dispatch({ type: 'TICK', config }), paused || complete ? null : 1000)
  useOnceWhen(complete, () =>
    onEnd({ durationSeconds: state.sessionElapsedSeconds, setsCompleted: state.setsCompleted }),
  )

  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    if (state.phase !== prevPhase) {
      if (state.phase === 'complete') {
        playTone('sessionComplete')
      } else if (prevPhase === 'work' && state.phase === 'rest') {
        playTone('roundComplete') // End Set pressed - a full set just finished
      } else if (prevPhase === 'rest' && state.phase === 'work') {
        playTone('transition') // rest timer expired, back to work
      }
    }
    prevPhaseRef.current = state.phase
  }, [state.phase])

  const setRestSeconds = (value) => {
    if (state.phase === 'rest') {
      dispatch({ type: 'ADJUST_REST_REMAINING', delta: value - config.restSeconds })
    }
    onConfigChange({ ...config, restSeconds: value })
  }

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time so far.')) return
    onEnd({ durationSeconds: state.sessionElapsedSeconds, setsCompleted: state.setsCompleted })
  }

  const phaseLabel = complete ? 'Session complete' : state.phase === 'work' ? 'Work' : 'Rest'
  const phaseColor = complete
    ? 'text-neutral-500 dark:text-neutral-400'
    : state.phase === 'work'
      ? 'text-indigo-600 dark:text-indigo-400'
      : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={`text-xl font-semibold uppercase tracking-wide ${phaseColor}`}>{phaseLabel}</p>
        <p className="text-8xl font-bold tabular-nums">
          {state.phase === 'rest'
            ? formatMMSS(state.restRemainingSeconds)
            : formatMMSS(state.workElapsedSeconds)}
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>Session</span>
          <span>
            {formatMMSS(state.sessionElapsedSeconds)} / {formatMMSS(config.sessionTargetSeconds)}
          </span>
        </div>
        <ProgressBar value={state.sessionElapsedSeconds / config.sessionTargetSeconds} />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Rest"
          value={config.restSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          disabled={complete}
          onChange={setRestSeconds}
        />
        <AdjustableChip
          label="Session target"
          value={config.sessionTargetSeconds}
          formatValue={formatMMSS}
          step={60}
          min={60}
          disabled={complete}
          onChange={(v) => onConfigChange({ ...config, sessionTargetSeconds: v })}
        />
        <AdjustableChip
          label="Sets"
          value={state.setsCompleted}
          formatValue={(v) => String(v)}
          step={1}
          min={0}
          disabled={complete}
          onChange={(v) => dispatch({ type: 'SET_SETS_COMPLETED', value: v })}
        />
      </div>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={complete}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={complete || state.phase !== 'work'}
          onClick={() => dispatch({ type: 'END_SET', restSeconds: config.restSeconds })}
        >
          End Set / Start Rest
        </button>
      </div>

      <div className="flex justify-center">
        <button type="button" className={dangerButtonClass} disabled={complete} onClick={handleEndWorkout}>
          End Workout
        </button>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">Movements</p>
          {sideMode !== 'bilateral' && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {SIDE_MODE_LABELS[sideMode]}
            </p>
          )}
        </div>
        <MovementReference exercises={exercises} sideMode={sideMode} />
      </div>
    </div>
  )
}
