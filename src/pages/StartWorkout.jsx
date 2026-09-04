import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import CategoryBadge from '../components/CategoryBadge'
import TimerModeConfigFields, { TimerModePicker } from '../components/TimerModeConfigFields'
import { getExercises, getWorkoutTemplate } from '../db'
import { unlockAudio } from '../lib/audioCues'
import { useActiveSession } from '../lib/activeSessionStore'
import { formatMMSS } from '../lib/formatDuration'
import { majorityCategory, resolveSessionConfig } from '../lib/sessionConfig'
import { computeStepSessionDurationSeconds } from '../lib/sessionEngine'
import { formatSetsReps } from '../lib/setsReps'
import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'

/** Total estimated session length, live as chips change - null for Open Work, which
 * runs to its own fixed session-target duration instead. */
function TotalDurationSummary({ timerMode, config, exerciseCount }) {
  if (timerMode === 'open_work') return null
  const modeConfig = timerMode === 'interval' ? config.intervalConfig : config.pailsRailsConfig
  const totalSeconds = computeStepSessionDurationSeconds(timerMode, modeConfig, exerciseCount)
  return (
    <p className="text-sm text-neutral-500 dark:text-neutral-400">
      Estimated total: <span className="font-medium text-neutral-700 dark:text-neutral-300">{formatMMSS(totalSeconds)}</span>
    </p>
  )
}

function EmptyState({ message }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Start Workout</h1>
      <p className="text-neutral-500 dark:text-neutral-400">{message}</p>
      <div className="flex gap-2">
        <Link to="/library" className={primaryButtonClass}>
          Library
        </Link>
        <Link to="/builder" className={secondaryButtonClass}>
          Builder
        </Link>
      </div>
    </section>
  )
}

function StartWorkoutForm({ template, steps, setsReps, workoutName, category }) {
  const navigate = useNavigate()
  const { dispatch } = useActiveSession()
  const [config, setConfig] = useState(() => resolveSessionConfig(template, category))

  const begin = () => {
    // The tap that actually starts the workout - and so the one that unlocks audio
    // for the auto-triggered cues later in the session. The session itself still
    // lands paused/ready until a separate Start tap inside the Tracker (item 7).
    unlockAudio()
    const { timerMode, ...sessionConfig } = config
    dispatch({
      type: 'START_SESSION',
      templateId: template?.id ?? null,
      workoutName,
      category,
      exerciseIds: steps.map((step) => step.id),
      setsReps,
      timerMode,
      config: sessionConfig,
    })
    navigate('/tracker')
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-xl font-semibold">{workoutName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={category} />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {steps.length} exercise{steps.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Exercises</p>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li
              key={`${step.id}-${index}`}
              className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
            >
              <p className="text-sm font-medium">{step.name}</p>
              {setsReps[index] && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatSetsReps(setsReps[index])}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Timer mode
        </p>
        <TimerModePicker
          value={config.timerMode}
          onChange={(timerMode) => setConfig({ ...config, timerMode })}
        />
        <div className="mt-3">
          <TimerModeConfigFields
            timerMode={config.timerMode}
            config={config}
            onChange={(patch) => setConfig({ ...config, ...patch })}
            idPrefix="start"
          />
        </div>
        <div className="mt-3">
          <TotalDurationSummary timerMode={config.timerMode} config={config} exerciseCount={steps.length} />
        </div>
      </div>

      <button type="button" className={`${primaryButtonClass} w-full`} onClick={begin}>
        Begin
      </button>
    </div>
  )
}

export default function StartWorkout() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const templateId = searchParams.get('templateId')
  const builderExerciseIds =
    location.state?.source === 'builder' ? location.state.exerciseIds : null

  const template = useLiveQuery(
    () => (templateId ? getWorkoutTemplate(Number(templateId)) : Promise.resolve(null)),
    [templateId],
  )
  const allExercises = useLiveQuery(() => getExercises(), [])

  if (!templateId && !builderExerciseIds) {
    return <EmptyState message="No workout selected. Pick one from Library or Builder." />
  }

  if (allExercises === undefined || (templateId && template === undefined)) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      </section>
    )
  }

  if (templateId && template === null) {
    return <EmptyState message="Template not found." />
  }

  const exercisesById = new Map(allExercises.map((ex) => [ex.id, ex]))
  const exerciseIds = template ? template.exerciseIds : builderExerciseIds
  const rawSetsReps = template?.setsReps ?? []
  // Zipped and filtered together so a since-deleted exercise can't shift setsReps
  // out of alignment with the steps it's meant to describe.
  const resolved = exerciseIds
    .map((id, i) => ({ step: exercisesById.get(id), scheme: rawSetsReps[i] }))
    .filter((entry) => entry.step)
  const steps = resolved.map((entry) => entry.step)
  const setsReps = resolved.map((entry) => entry.scheme)

  if (steps.length === 0) {
    return <EmptyState message="This workout has no exercises." />
  }

  return (
    <StartWorkoutForm
      template={template}
      steps={steps}
      setsReps={setsReps}
      workoutName={template ? template.name : 'On-the-fly Workout'}
      category={template ? template.category : majorityCategory(steps)}
    />
  )
}
