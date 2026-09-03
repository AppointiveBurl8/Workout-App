import { useEffect } from 'react'
import { playTone } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import {
  dangerButtonClass,
  iconButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../lib/ui'
import IntervalStep from './IntervalStep'
import PailsRailsStep from './PailsRailsStep'

function roundsLabel(rounds) {
  return `${rounds} round${rounds === 1 ? '' : 's'}`
}

/** One config runs every exercise in the session, so the summary describes the session, not the movement. */
function summarize(timerMode, config) {
  if (timerMode === 'interval') {
    const { workSeconds, restSeconds, rounds } = config
    return `Work ${formatMMSS(workSeconds)} / Rest ${formatMMSS(restSeconds)} × ${roundsLabel(rounds)}`
  }
  const { holdSeconds, pailsHoldSeconds, railsHoldSeconds, rounds } = config
  return `Stretch ${formatMMSS(holdSeconds)} / PAILs ${formatMMSS(pailsHoldSeconds)} / RAILs ${formatMMSS(railsHoldSeconds)} × ${roundsLabel(rounds)}`
}

function TransitionScreen({ nextExercise, summary, remainingSeconds, paused, onTogglePause, onSkip }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="text-base font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Up Next
      </p>
      <p className="text-3xl font-semibold">{nextExercise.name}</p>
      {nextExercise.repsLabel && (
        <p className="-mt-3 text-base text-neutral-600 dark:text-neutral-300">
          {nextExercise.repsLabel}
        </p>
      )}
      <p className="text-base text-neutral-500 dark:text-neutral-400">{summary}</p>
      <p className="text-8xl font-bold tabular-nums">{formatMMSS(remainingSeconds)}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className={secondaryButtonClass} onClick={onTogglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className={primaryButtonClass} onClick={onSkip}>
          Skip wait, start now
        </button>
      </div>
    </div>
  )
}

export default function SteppedSession({ steps, session, dispatch }) {
  const { timerMode, currentIndex, transitioning, transitionRemaining, paused, started, stepState } = session
  const config = timerMode === 'interval' ? session.config.intervalConfig : session.config.pailsRailsConfig
  const currentExercise = steps[currentIndex]
  const nextExercise = steps[currentIndex + 1]

  useEffect(() => {
    if (transitioning && transitionRemaining <= 3 && transitionRemaining >= 1) {
      playTone('tick')
    }
  }, [transitioning, transitionRemaining])

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time so far.')) return
    dispatch({ type: 'END_WORKOUT' })
  }

  const adjustConfig = (field, value) => dispatch({ type: 'ADJUST_CONFIG', field, value })

  return (
    <div className="flex flex-1 flex-col">
      {transitioning && nextExercise ? (
        <TransitionScreen
          nextExercise={nextExercise}
          summary={summarize(timerMode, config)}
          remainingSeconds={transitionRemaining}
          paused={paused}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onSkip={() => dispatch({ type: 'SKIP_TRANSITION' })}
        />
      ) : (
        <>
          <p className="px-6 pt-4 text-center text-xl font-medium">{currentExercise.name}</p>
          {currentExercise.repsLabel && (
            <p className="px-6 pt-1 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {currentExercise.repsLabel}
            </p>
          )}

          {/* Freshly initialized stepState already shows the full configured duration
              at 0 elapsed, so the same step component doubles as the paused "ready"
              screen before Start is tapped (item 7) - only the transport row changes. */}
          {timerMode === 'interval' ? (
            <IntervalStep key={currentIndex} config={config} stepState={stepState} onAdjustConfig={adjustConfig} />
          ) : (
            <PailsRailsStep key={currentIndex} config={config} stepState={stepState} onAdjustConfig={adjustConfig} />
          )}

          <div className="flex items-center justify-center gap-3 pb-4">
            {started ? (
              <>
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => dispatch({ type: 'PREV' })}
                  disabled={currentIndex === 0}
                >
                  ⏮ Prev
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => dispatch({ type: 'SKIP_PHASE' })}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => dispatch({ type: 'NEXT' })}
                  disabled={currentIndex === steps.length - 1}
                >
                  Next ⏭
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${primaryButtonClass} px-10`}
                onClick={() => dispatch({ type: 'START' })}
              >
                Start
              </button>
            )}
          </div>
        </>
      )}

      <div className="flex justify-center pb-6">
        <button type="button" className={dangerButtonClass} onClick={handleEndWorkout}>
          End Workout
        </button>
      </div>
    </div>
  )
}
