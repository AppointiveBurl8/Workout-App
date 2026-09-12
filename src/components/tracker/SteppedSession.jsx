import { useEffect, useRef } from 'react'
import { playTone } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import {
  SIDE_LABELS,
  advanceSessionPosition,
  isUnilateral,
  retreatSessionPosition,
} from '../../lib/sessionEngine'
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
  sideLabel,
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
      {sideLabel && (
        <p className="-mt-3 text-base font-medium text-neutral-600 dark:text-neutral-300">{sideLabel}</p>
      )}
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
    round,
    side,
    pendingPosition,
    paused,
    started,
    stepState,
  } = session
  const config = timerMode === 'interval' ? session.config.intervalConfig : session.config.pailsRailsConfig
  const currentExercise = steps[currentIndex]

  // The session is a circuit - the exercise list per round, and on a unilateral
  // workout all of that once per side - so what comes next isn't currentIndex + 1.
  const position = {
    currentIndex,
    round,
    side,
    exerciseCount: steps.length,
    rounds: config.rounds,
    unilateral: isUnilateral(timerMode, config),
  }
  const forward = advanceSessionPosition(position)
  const backward = retreatSessionPosition(position)

  const countdownRemaining = leadIn ? leadInRemaining : transitioning ? transitionRemaining : null

  useEffect(() => {
    if (countdownRemaining !== null && countdownRemaining <= 3 && countdownRemaining >= 1) {
      playTone('tick')
    }
  }, [countdownRemaining])

  // Completing a circuit is worth a cue of its own. It can't live in the step
  // component any more: a round now ends by moving to a different exercise, which
  // remounts that component and loses the before/after it would compare.
  const prevRoundRef = useRef(round)
  useEffect(() => {
    if (round > prevRoundRef.current) playTone('roundComplete')
    prevRoundRef.current = round
  }, [round])

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
        sideLabel: side ? SIDE_LABELS[side] : null,
        remainingSeconds: leadInRemaining,
        skipLabel: 'Skip, I\u2019m ready',
        onSkip: () => dispatch({ type: 'SKIP_LEAD_IN' }),
      }
    }
    if (transitioning && pendingPosition) {
      const switchingSides = pendingPosition.side !== side
      const sideLabel = pendingPosition.side ? SIDE_LABELS[pendingPosition.side] : null
      const roundLabel = `Round ${pendingPosition.round} of ${config.rounds}`
      return {
        heading: switchingSides ? 'Switch Sides' : 'Up Next',
        exerciseName: steps[pendingPosition.currentIndex].name,
        sideLabel: sideLabel ? `${sideLabel} \u00b7 ${roundLabel}` : roundLabel,
        remainingSeconds: transitionRemaining,
        skipLabel: switchingSides ? 'Skip wait, I\u2019m over' : 'Skip wait, start now',
        onSkip: () => dispatch({ type: 'SKIP_TRANSITION' }),
      }
    }
    return null
  }
  const countdown = activeCountdown()

  /** What the rest timer is resting for - the whole point of the rest, really. */
  function restNextUp() {
    if (timerMode !== 'interval' || stepState.phase !== 'rest') return null
    if (forward.done) return 'Last one \u2014 the workout ends after this'
    const parts = [steps[forward.currentIndex].name]
    if (forward.side !== side) parts.push(SIDE_LABELS[forward.side].toLowerCase())
    if (forward.round !== round) parts.push(`round ${forward.round} of ${config.rounds}`)
    return `Next: ${parts.join(', ')}`
  }

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
            <IntervalStep
              key={`${side}-${round}-${currentIndex}`}
              config={config}
              stepState={stepState}
              side={side}
              round={round}
              rounds={config.rounds}
              nextUp={restNextUp()}
              onAdjustConfig={adjustConfig}
            />
          ) : (
            <PailsRailsStep
              key={`${side}-${round}-${currentIndex}`}
              config={config}
              stepState={stepState}
              side={side}
              round={round}
              rounds={config.rounds}
              onAdjustConfig={adjustConfig}
            />
          )}

          <div className="flex items-center justify-center gap-3 pb-4">
            {started ? (
              <>
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => dispatch({ type: 'PREV' })}
                  disabled={!backward}
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
                  disabled={forward.done}
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
