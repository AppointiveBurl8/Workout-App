import { useEffect, useRef } from 'react'
import { playTone } from '../../lib/audioCues'
import { SIDE_MODE_LABELS } from '../../lib/categories'
import { formatMMSS } from '../../lib/formatDuration'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

function MovementRow({ exercise, detail }) {
  return (
    <li className="rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-base font-medium">{exercise.name}</p>
      {detail && <p className="text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>}
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
                <MovementRow key={ex.id} exercise={ex} />
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
          <MovementRow key={ex.id} exercise={ex} detail="Left, then right" />
        ))}
      </ul>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((ex) => (
        <MovementRow key={ex.id} exercise={ex} />
      ))}
    </ul>
  )
}

export default function OpenWorkSession({ exercises, session, dispatch }) {
  const { openWork: state, started, paused, config } = session
  const openWorkConfig = config.openWorkConfig
  const sideMode = config.sideMode
  const complete = state.phase === 'complete'
  const prevPhaseRef = useRef(state.phase)

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

  const setRestSeconds = (value) => dispatch({ type: 'ADJUST_OPEN_WORK_CONFIG', field: 'restSeconds', value })

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time so far.')) return
    dispatch({ type: 'END_WORKOUT' })
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
            {formatMMSS(state.sessionElapsedSeconds)} / {formatMMSS(openWorkConfig.sessionTargetSeconds)}
          </span>
        </div>
        <ProgressBar value={state.sessionElapsedSeconds / openWorkConfig.sessionTargetSeconds} />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Rest"
          value={openWorkConfig.restSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          disabled={complete}
          onChange={setRestSeconds}
        />
        <AdjustableChip
          label="Session target"
          value={openWorkConfig.sessionTargetSeconds}
          formatValue={formatMMSS}
          step={60}
          min={60}
          disabled={complete}
          onChange={(v) => dispatch({ type: 'ADJUST_OPEN_WORK_CONFIG', field: 'sessionTargetSeconds', value: v })}
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
        {started ? (
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={complete}
              onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
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
          </>
        ) : (
          <button type="button" className={`${primaryButtonClass} px-10`} onClick={() => dispatch({ type: 'START' })}>
            Start
          </button>
        )}
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
