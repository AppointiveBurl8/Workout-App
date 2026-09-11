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

/** Serves both waits: the get-into-position lead-in and the between-exercise one. */
function CountdownScreen({
  heading,
  exerciseName,
  summary,
  remainingSeconds,
  skipLabel,
  paused,
  onTogglePause,
  onSkip,
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="text-base font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {heading}
      </p>
      <p className="text-3xl font-semibold">{exerciseName}</p>
      <p className="text-base text-neutral-500 dark:text-neutral-400">{summary}</p>
      <p className="text-8xl font-bold tabular-nums">{formatMMSS(remainingSeconds)}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className={secondaryButtonClass} onClick={onTogglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className={primaryButtonClass} onClick={onSkip}>
          {skipLabel}
        </button>
      </div>
    </div>
  )
}

export default function SteppedSession({ steps, session, dispatch }) {
  const {
    timerMode,
    currentIndex,
    transitioning,
    transitionRemaining,
    leadIn,
    leadInRemaining,
    paused,
    started,
    stepState,
  } = session
  const config = timerMode === 'interval' ? session.config.intervalConfig : session.config.pailsRailsConfig
  const currentExercise = steps[currentIndex]
  const nextExercise = steps[currentIndex + 1]

  const countdownRemaining = leadIn ? leadInRemaining : transitioning ? transitionRemaining : null

  useEffect(() => {
    if (countdownRemaining !== null && countdownRemaining <= 3 && countdownRemaining >= 1) {
      playTone('tick')
    }
  }, [countdownRemaining])

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time so far.')) return
    dispatch({ type: 'END_WORKOUT' })
  }

  const adjustConfig = (field, value) => dispatch({ type: 'ADJUST_CONFIG', field, value })

  function activeCountdown() {
    if (leadIn) {
      return {
        heading: 'Get Into Position',
        exerciseName: currentExercise.name,
        remainingSeconds: leadInRemaining,
        skipLabel: 'Skip, I\u2019m ready',
        onSkip: () => dispatch({ type: 'SKIP_LEAD_IN' }),
      }
    }
    if (transitioning && nextExercise) {
      return {
        heading: 'Up Next',
        exerciseName: nextExercise.name,
        remainingSeconds: transitionRemaining,
        skipLabel: 'Skip wait, start now',
        onSkip: () => dispatch({ type: 'SKIP_TRANSITION' }),
      }
    }
    return null
  }
  const countdown = activeCountdown()

  return (
    <div className="flex flex-1 flex-col">
      {countdown ? (
        <CountdownScreen
          {...countdown}
          summary={summarize(timerMode, config)}
          paused={paused}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
        />
      ) : (
        <>
          <p className="px-6 pt-4 text-center text-xl font-medium">{currentExercise.name}</p>

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
