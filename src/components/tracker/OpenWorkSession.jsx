import { useEffect, useReducer, useRef, useState } from 'react'
import { playTone } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval, useOnceWhen } from '../../lib/useInterval'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

const DEFAULT_REST_SECONDS = 120
const DEFAULT_SESSION_TARGET_SECONDS = 1200

function resolveDefaultRest(exercises) {
  for (const ex of exercises) {
    if (ex.timerMode === 'open_work' && ex.openWork?.restSeconds) {
      return ex.openWork.restSeconds
    }
  }
  return DEFAULT_REST_SECONDS
}

function init({ exercises, sessionTargetSeconds }) {
  return {
    phase: 'work', // 'work' | 'rest' | 'complete'
    workElapsedSeconds: 0,
    restRemainingSeconds: 0,
    sessionElapsedSeconds: 0,
    restSeconds: resolveDefaultRest(exercises),
    sessionTargetSeconds: sessionTargetSeconds || DEFAULT_SESSION_TARGET_SECONDS,
    setsCompleted: 0,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      if (state.phase === 'complete') return state
      const sessionElapsedSeconds = state.sessionElapsedSeconds + 1
      if (sessionElapsedSeconds >= state.sessionTargetSeconds) {
        return { ...state, phase: 'complete', sessionElapsedSeconds: state.sessionTargetSeconds }
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
        restRemainingSeconds: state.restSeconds,
        setsCompleted: state.setsCompleted + 1,
      }
    }
    case 'SET_REST_SECONDS':
      return { ...state, restSeconds: Math.max(0, action.value) }
    case 'SET_SESSION_TARGET':
      return { ...state, sessionTargetSeconds: Math.max(60, action.value) }
    case 'SET_SETS_COMPLETED':
      return { ...state, setsCompleted: Math.max(0, action.value) }
    default:
      return state
  }
}

export default function OpenWorkSession({ exercises, sessionTargetSeconds, onEnd }) {
  const [state, dispatch] = useReducer(reducer, { exercises, sessionTargetSeconds }, init)
  const [paused, setPaused] = useState(false)
  const complete = state.phase === 'complete'
  const prevPhaseRef = useRef(state.phase)

  useInterval(() => dispatch({ type: 'TICK' }), paused || complete ? null : 1000)
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
          {state.phase === 'rest' ? formatMMSS(state.restRemainingSeconds) : formatMMSS(state.workElapsedSeconds)}
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>Session</span>
          <span>
            {formatMMSS(state.sessionElapsedSeconds)} / {formatMMSS(state.sessionTargetSeconds)}
          </span>
        </div>
        <ProgressBar value={state.sessionElapsedSeconds / state.sessionTargetSeconds} />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Rest"
          value={state.restSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          disabled={complete}
          onChange={(v) => dispatch({ type: 'SET_REST_SECONDS', value: v })}
        />
        <AdjustableChip
          label="Session target"
          value={state.sessionTargetSeconds}
          formatValue={formatMMSS}
          step={60}
          min={60}
          disabled={complete}
          onChange={(v) => dispatch({ type: 'SET_SESSION_TARGET', value: v })}
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
          onClick={() => dispatch({ type: 'END_SET' })}
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
        <p className="mb-2 text-base font-medium text-neutral-700 dark:text-neutral-300">Movements</p>
        <ul className="flex flex-col gap-2">
          {exercises.map((ex) => (
            <li
              key={ex.id}
              className="rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800"
            >
              <p className="text-base font-medium">{ex.name}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {ex.openWork?.repsLabel || '—'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
