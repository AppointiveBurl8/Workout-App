import { formatMMSS } from '../../lib/formatDuration'
import { EMOM_PHASE_COLORS, EMOM_PHASE_LABELS, SIDE_LABELS } from '../../lib/sessionEngine'
import AdjustableChip from './AdjustableChip'
import ProgressBar from './ProgressBar'

/**
 * Presentational, like IntervalStep. One step is one minute: do the reps, and
 * whatever's left on the clock is the rest. There are no transition steps in
 * EMOM, so every step is a minute and the step index is the minute number.
 */
export default function EmomStep({
  config,
  remainingSeconds,
  phaseTotal,
  side,
  minute,
  minutes,
  round,
  rounds,
  nextUp,
  onAdjustConfig,
}) {
  const colors = EMOM_PHASE_COLORS.work

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p className={`text-xl font-semibold uppercase tracking-wide ${colors.label}`}>
        {EMOM_PHASE_LABELS.work}
      </p>
      {side && (
        <p className="-mt-4 text-base font-medium text-neutral-600 dark:text-neutral-300">
          {SIDE_LABELS[side]}
        </p>
      )}
      <p className="text-8xl font-bold tabular-nums">{formatMMSS(remainingSeconds)}</p>
      <div className="w-full max-w-xs">
        <ProgressBar
          value={phaseTotal > 0 ? 1 - remainingSeconds / phaseTotal : 1}
          colorClassName={colors.bar}
        />
      </div>
      <div className="text-base text-neutral-500 dark:text-neutral-400">
        <p className="font-medium text-neutral-700 dark:text-neutral-200">
          Minute {minute} of {minutes}
        </p>
        <p>
          Round {round} of {rounds}
        </p>
      </div>

      {nextUp && (
        <p className="-mt-3 max-w-xs text-base font-medium text-neutral-700 dark:text-neutral-200">
          {nextUp}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <AdjustableChip
          label="Every"
          value={config.intervalSeconds}
          formatValue={formatMMSS}
          step={15}
          min={15}
          onChange={(v) => onAdjustConfig('intervalSeconds', v)}
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
