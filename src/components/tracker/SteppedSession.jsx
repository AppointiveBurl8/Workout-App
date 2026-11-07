import { useEffect, useRef } from 'react'
import { playTone, unlockAudio } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import {
  SIDE_LABELS,
  buildStepSequence,
  stepDurationSeconds,
} from '../../lib/sessionEngine'
import {
  dangerButtonClass,
  iconButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../lib/ui'
import EmomStep from './EmomStep'
import IntervalStep from './IntervalStep'
import PailsRailsStep from './PailsRailsStep'

function roundsLabel(rounds) {
  return `${rounds} round${rounds === 1 ? '' : 's'}`
}

/** One config runs every exercise in the session, so the summary describes the session, not the movement. */
function summarize(timerMode, config) {
  if (timerMode === 'emom') {
    return `Every ${formatMMSS(config.intervalSeconds)} × ${roundsLabel(config.rounds)}`
  }
  if (timerMode === 'interval') {
    const { workSeconds, restSeconds, rounds } = config
    return `Work ${formatMMSS(workSeconds)} / Rest ${formatMMSS(restSeconds)} × ${roundsLabel(rounds)}`
  }
  const { holdSeconds, pailsHoldSeconds, railsHoldSeconds, rounds } = config
  return `Stretch ${formatMMSS(holdSeconds)} / PAILs ${formatMMSS(pailsHoldSeconds)} / RAILs ${formatMMSS(railsHoldSeconds)} × ${roundsLabel(rounds)}`
}

/**
 * Previous / Pause-Resume / Next - the only step navigation there is. Neither
 * arrow is ever disabled: Next always has somewhere to go (the end of the
 * workout counts), and Previous restarts the step when there's nothing behind it.
 */
function Transport({ paused, onPrev, onTogglePause, onNext }) {
  return (
    <div className="flex items-center justify-center gap-3 pb-4">
      <button type="button" className={iconButtonClass} onClick={onPrev}>
        ⏮ Prev
      </button>
      <button type="button" className={secondaryButtonClass} onClick={onTogglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className={iconButtonClass} onClick={onNext}>
        Next ⏭
      </button>
    </div>
  )
}

/** Serves both waits: the get-into-position lead-in and the between-exercise one. */
function CountdownScreen({ heading, exerciseName, sideLabel, summary, remainingSeconds, children }) {
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
      {children}
    </div>
  )
}

const CONFIG_KEY = { interval: 'intervalConfig', pails_rails: 'pailsRailsConfig', emom: 'emomConfig' }

export default function SteppedSession({ steps: exercises, session, dispatch }) {
  const { timerMode, leadIn, leadInRemaining, stepIndex, stepElapsedSeconds, paused, started } =
    session
  const config = session.config[CONFIG_KEY[timerMode]]

  // Everything on screen comes off the step at the current index - round, side,
  // exercise, phase, colour and timer - so there is nothing to keep in sync.
  const sequence = buildStepSequence(exercises, timerMode, config)
  const step = sequence[stepIndex]
  const previousStep = sequence[stepIndex - 1]
  const nextStep = sequence[stepIndex + 1]

  const round = step?.round ?? 1
  const exercise = step ? exercises[step.exerciseIndex] : null
  const total = stepDurationSeconds(step, timerMode, config)
  const remainingSeconds = Math.max(0, total - stepElapsedSeconds)

  // EMOM counts the last three seconds of every minute too: the next one starts
  // on the beep whether you're ready or not.
  const countdownRemaining = leadIn
    ? leadInRemaining
    : step?.kind === 'transition' || (timerMode === 'emom' && started)
      ? remainingSeconds
      : null

  useEffect(() => {
    if (countdownRemaining !== null && countdownRemaining <= 3 && countdownRemaining >= 1) {
      playTone('tick')
    }
  }, [countdownRemaining])

  // One cue per step change, wherever the change came from: the timer running
  // out, Next, or Previous all move the same index, so a manually taken step
  // sounds exactly like one reached by waiting.
  const prevCueRef = useRef({ stepIndex, round, leadIn })
  useEffect(() => {
    const prev = prevCueRef.current
    const startedNewStep = stepIndex !== prev.stepIndex || (prev.leadIn && !leadIn)
    if (startedNewStep) playTone(round > prev.round ? 'roundComplete' : 'transition')
    prevCueRef.current = { stepIndex, round, leadIn }
  }, [stepIndex, round, leadIn])

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time so far.')) return
    dispatch({ type: 'END_WORKOUT' })
  }

  const transport = (
    <Transport
      paused={paused}
      onPrev={() => dispatch({ type: 'PREV' })}
      onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      onNext={() => dispatch({ type: 'NEXT' })}
    />
  )

  if (!step) return null

  /** What the rest timer is resting for - the whole point of the rest, really.
   * An EMOM minute is part work, part rest, so it always says what's next. */
  function restNextUp() {
    const resting = timerMode === 'interval' && step.kind === 'phase' && step.phase === 'rest'
    if (!resting && timerMode !== 'emom') return null
    if (!nextStep) return 'Last one — the workout ends after this'
    const parts = [exercises[nextStep.exerciseIndex].name]
    // A symmetrical movement has no side to name, so say nothing rather than
    // announcing a side it doesn't have.
    if (nextStep.side && nextStep.side !== step.side) {
      parts.push(SIDE_LABELS[nextStep.side].toLowerCase())
    }
    if (nextStep.round !== round) parts.push(`round ${nextStep.round} of ${config.rounds}`)
    return `Next: ${parts.join(', ')}`
  }

  function countdownProps() {
    if (leadIn) {
      return {
        heading: 'Get Into Position',
        exerciseName: exercise.name,
        sideLabel: step.side ? SIDE_LABELS[step.side] : null,
        remainingSeconds: leadInRemaining,
      }
    }
    const switchingSides = previousStep && previousStep.passIndex !== step.passIndex
    const sideLabel = step.side ? SIDE_LABELS[step.side] : null
    const roundLabel = `Round ${step.round} of ${config.rounds}`
    return {
      heading: switchingSides ? 'Switch Sides' : 'Up Next',
      exerciseName: exercise.name,
      sideLabel: sideLabel ? `${sideLabel} · ${roundLabel}` : roundLabel,
      remainingSeconds,
    }
  }

  const showingCountdown = leadIn || step.kind === 'transition'

  return (
    <div className="flex flex-1 flex-col">
      {showingCountdown ? (
        <CountdownScreen {...countdownProps()} summary={summarize(timerMode, config)}>
          {transport}
        </CountdownScreen>
      ) : (
        <>
          <p className="px-6 pt-4 text-center text-xl font-medium">{exercise.name}</p>

          {/* A step sitting at 0 elapsed already shows its full configured
              duration, so the same component doubles as the paused "ready"
              screen before Start is tapped - only the transport row changes. */}
          {timerMode === 'emom' ? (
            <EmomStep
              config={config}
              remainingSeconds={remainingSeconds}
              phaseTotal={total}
              side={step.side}
              minute={stepIndex + 1}
              minutes={sequence.length}
              round={round}
              rounds={config.rounds}
              nextUp={restNextUp()}
              onAdjustConfig={(field, value) => dispatch({ type: 'ADJUST_CONFIG', field, value })}
            />
          ) : timerMode === 'interval' ? (
            <IntervalStep
              config={config}
              phase={step.phase}
              remainingSeconds={remainingSeconds}
              phaseTotal={total}
              side={step.side}
              round={round}
              rounds={config.rounds}
              nextUp={restNextUp()}
              onAdjustConfig={(field, value) => dispatch({ type: 'ADJUST_CONFIG', field, value })}
            />
          ) : (
            <PailsRailsStep
              config={config}
              phase={step.phase}
              remainingSeconds={remainingSeconds}
              phaseTotal={total}
              side={step.side}
              round={round}
              rounds={config.rounds}
              onAdjustConfig={(field, value) => dispatch({ type: 'ADJUST_CONFIG', field, value })}
            />
          )}

          {started ? (
            transport
          ) : (
            <div className="flex items-center justify-center gap-3 pb-4">
              <button
                type="button"
                className={`${primaryButtonClass} px-10`}
                onClick={() => {
                  unlockAudio() // a refresh mid-session reaches here without passing Start Workout
                  dispatch({ type: 'START' })
                }}
              >
                Start
              </button>
            </div>
          )}
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
