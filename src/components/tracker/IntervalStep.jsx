import { usePhaseTransitionCues } from '../../lib/audioCues'
import { formatMMSS } from '../../lib/formatDuration'
import {
  INTERVAL_PHASE_COLORS,
  INTERVAL_PHASE_LABELS,
  SIDE_LABELS,
  stepPhaseTotal,
} from '../../lib/sessionEngine'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

/**
 * Purely presentational - the phase machine lives in the app-level active-session
 * store so it survives leaving the Tracker tab. This component just renders the
 * current step state and forwards chip edits / phase-cue audio for it.
 */
export default function IntervalStep({ config, stepState, side, round, rounds, nextUp, onAdjustConfig }) {
  usePhaseTransitionCues(stepState.phase, round, stepState.done)

  const phaseTotal = stepPhaseTotal('interval', stepState, config)
  const colors = INTERVAL_PHASE_COLORS[stepState.phase]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p className={`text-xl font-semibold uppercase tracking-wide ${colors.label}`}>
        {INTERVAL_PHASE_LABELS[stepState.phase]}
      </p>
      {side && (
        <p className="-mt-4 text-base font-medium text-neutral-600 dark:text-neutral-300">
          {SIDE_LABELS[side]}
        </p>
      )}
      <p className="text-8xl font-bold tabular-nums">{formatMMSS(stepState.remainingSeconds)}</p>
      <div className="w-full max-w-xs">
        <ProgressBar
          value={phaseTotal > 0 ? 1 - stepState.remainingSeconds / phaseTotal : 1}
          colorClassName={colors.bar}
        />
      </div>
      <p className="text-base text-neutral-500 dark:text-neutral-400">
        Round {round} of {rounds}
      </p>

      {/* During rest the useful question is what you're resting for. */}
      {nextUp && (
        <p className="-mt-3 max-w-xs text-base font-medium text-neutral-700 dark:text-neutral-200">
          {nextUp}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Work"
          value={config.workSeconds}
          formatValue={formatMMSS}
          step={5}
          min={5}
          onChange={(v) => onAdjustConfig('workSeconds', v)}
        />
        <AdjustableChip
          label="Rest"
          value={config.restSeconds}
          formatValue={formatMMSS}
          step={5}
          min={0}
          onChange={(v) => onAdjustConfig('restSeconds', v)}
        />
        <AdjustableChip
          label="Rounds"
          value={config.rounds}
          formatValue={(v) => String(v)}
          step={1}
          min={1}
          onChange={(v) => onAdjustConfig('rounds', v)}
        />
      </div>
    </div>
  )
}
