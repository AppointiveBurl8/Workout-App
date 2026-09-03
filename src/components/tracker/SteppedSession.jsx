import { useEffect, useState } from 'react'
import { playTone } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { useInterval } from '../../lib/useInterval'
import { dangerButtonClass, iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui'
import IntervalStep from './IntervalStep'
import PailsRailsStep from './PailsRailsStep'

const TRANSITION_SECONDS = 10

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

export default function SteppedSession({ steps, timerMode, config, onConfigChange, onEnd }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionRemaining, setTransitionRemaining] = useState(TRANSITION_SECONDS)
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0)

  const currentExercise = steps[currentIndex]
  const nextExercise = steps[currentIndex + 1]
  const isLast = currentIndex === steps.length - 1

  useInterval(() => setSessionElapsedSeconds((s) => s + 1), paused ? null : 1000)

  useInterval(
    () => {
      if (transitionRemaining <= 1) {
        setTransitioning(false)
        setCurrentIndex((i) => i + 1)
        setTransitionRemaining(TRANSITION_SECONDS)
      } else {
        setTransitionRemaining((s) => s - 1)
      }
    },
    transitioning && !paused ? 1000 : null,
  )

  useEffect(() => {
    if (transitioning && transitionRemaining <= 3 && transitionRemaining >= 1) {
      playTone('tick')
    }
  }, [transitioning, transitionRemaining])

  const handleStepComplete = () => {
    if (isLast) {
      onEnd({ durationSeconds: sessionElapsedSeconds, setsCompleted: null })
      return
    }
    setTransitionRemaining(TRANSITION_SECONDS)
    setTransitioning(true)
  }

  const skipWait = () => {
    setTransitioning(false)
    setTransitionRemaining(TRANSITION_SECONDS)
    setCurrentIndex((i) => i + 1)
  }

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentIndex((i) => Math.min(steps.length - 1, i + 1))

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time so far.')) return
    onEnd({ durationSeconds: sessionElapsedSeconds, setsCompleted: null })
  }

  const stepKey = `${currentIndex}-${currentExercise.id}`

  return (
    <div className="flex flex-1 flex-col">
      {transitioning && nextExercise ? (
        <TransitionScreen
          nextExercise={nextExercise}
          summary={summarize(timerMode, config)}
          remainingSeconds={transitionRemaining}
          paused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          onSkip={skipWait}
        />
      ) : (
        <>
          <p className="px-6 pt-4 text-center text-xl font-medium">{currentExercise.name}</p>
          {currentExercise.repsLabel && (
            <p className="px-6 pt-1 text-center text-sm text-neutral-500 dark:text-neutral-400">
              {currentExercise.repsLabel}
            </p>
          )}

          {timerMode === 'interval' ? (
            <IntervalStep
              key={stepKey}
              config={config}
              paused={paused}
              onComplete={handleStepComplete}
              onConfigChange={onConfigChange}
            />
          ) : (
            <PailsRailsStep
              key={stepKey}
              config={config}
              paused={paused}
              onComplete={handleStepComplete}
              onConfigChange={onConfigChange}
            />
          )}

          <div className="flex items-center justify-center gap-3 pb-4">
            <button type="button" className={iconButtonClass} onClick={goPrev} disabled={currentIndex === 0}>
              ⏮ Prev
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setPaused((p) => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className={iconButtonClass}
              onClick={goNext}
              disabled={currentIndex === steps.length - 1}
            >
              Next ⏭
            </button>
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
