import { useEffect, useRef } from 'react'
import { playTone, unlockAudio } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import { formatAmrapScore } from '../../lib/sessionEngine'
import {
  dangerButtonClass,
  iconButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../lib/ui'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

/**
 * As many rounds as possible before the cap. The clock counts down; the work is
 * self-paced. Tapping Done (or Next) marks the highlighted movement finished, and
 * finishing the last one scores a round - so you always know where you are in the
 * circuit without counting in your head.
 */
export default function AmrapSession({ exercises, session, dispatch }) {
  const { amrap: state, started, paused, leadIn, leadInRemaining, config } = session
  const { timeCapSeconds } = config.amrapConfig
  const remainingSeconds = Math.max(0, timeCapSeconds - state.elapsedSeconds)
  const isLast = state.movementIndex === exercises.length - 1

  const countdown = leadIn ? leadInRemaining : started ? remainingSeconds : null
  useEffect(() => {
    if (countdown !== null && countdown <= 3 && countdown >= 1) playTone('tick')
  }, [countdown])

  // Derived from the score changing, never from the tap itself, so Next, Done
  // and an undo all sound the same way the state they produce reads.
  const prevRef = useRef({ rounds: state.roundsCompleted, movement: state.movementIndex, leadIn })
  useEffect(() => {
    const prev = prevRef.current
    if (state.roundsCompleted > prev.rounds) playTone('roundComplete')
    else if (state.movementIndex !== prev.movement || (prev.leadIn && !leadIn)) playTone('transition')
    prevRef.current = { rounds: state.roundsCompleted, movement: state.movementIndex, leadIn }
  }, [state.roundsCompleted, state.movementIndex, leadIn])

  const handleEndWorkout = () => {
    if (!window.confirm('End this workout now? It will be logged with the time and rounds so far.')) return
    dispatch({ type: 'END_WORKOUT' })
  }

  const transport = (
    <div className="flex items-center justify-center gap-3">
      <button type="button" className={iconButtonClass} onClick={() => dispatch({ type: 'PREV' })}>
        ⏮ Prev
      </button>
      <button type="button" className={secondaryButtonClass} onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className={iconButtonClass} onClick={() => dispatch({ type: 'NEXT' })}>
        Next ⏭
      </button>
    </div>
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xl font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
          {leadIn ? 'Get Ready' : 'AMRAP'}
        </p>
        <p className="text-8xl font-bold tabular-nums">
          {formatMMSS(leadIn ? leadInRemaining : remainingSeconds)}
        </p>
        <p className="text-2xl font-semibold tabular-nums">{formatAmrapScore(state)}</p>
        {/* The list below is often off-screen; this is the line that matters mid-set. */}
        <p className="text-lg text-neutral-600 dark:text-neutral-300">
          Now: <span className="font-semibold">{exercises[state.movementIndex]?.name}</span>
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>Time cap</span>
          <span>
            {formatMMSS(state.elapsedSeconds)} / {formatMMSS(timeCapSeconds)}
          </span>
        </div>
        <ProgressBar value={state.elapsedSeconds / timeCapSeconds} colorClassName="bg-rose-600" />
      </div>

      {started ? (
        <div className="flex flex-col items-center gap-3">
          {/* The big target: this is the tap made mid-workout with chalky hands.
              Next does the same, and stays for consistency with the other modes. */}
          <button
            type="button"
            className={`${primaryButtonClass} w-full max-w-xs py-4 text-lg`}
            disabled={leadIn}
            onClick={() => dispatch({ type: 'NEXT' })}
          >
            {isLast ? 'Done · Round complete' : 'Done · Next movement'}
          </button>
          {transport}
        </div>
      ) : (
        <div className="flex justify-center gap-3">
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

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Time cap"
          value={timeCapSeconds}
          formatValue={formatMMSS}
          step={60}
          min={60}
          onChange={(v) => dispatch({ type: 'ADJUST_CONFIG', field: 'timeCapSeconds', value: v })}
        />
      </div>

      <div className="flex justify-center">
        <button type="button" className={dangerButtonClass} onClick={handleEndWorkout}>
          End Workout
        </button>
      </div>

      <div>
        <p className="mb-2 text-base font-medium text-neutral-700 dark:text-neutral-300">
          Each round
        </p>
        <ol className="flex flex-col gap-2">
          {exercises.map((exercise, index) => {
            const current = index === state.movementIndex
            const done = index < state.movementIndex
            return (
              <li
                key={`${exercise.id}-${index}`}
                aria-current={current ? 'step' : undefined}
                className={`rounded-md border px-4 py-3 ${
                  current
                    ? 'border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-950/40'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <p className={`text-base font-medium ${done ? 'text-neutral-400 line-through dark:text-neutral-500' : ''}`}>
                  {exercise.name}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
