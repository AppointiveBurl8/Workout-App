import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MuteToggle from '../components/tracker/MuteToggle'
import OpenWorkSession from '../components/tracker/OpenWorkSession'
import SteppedSession from '../components/tracker/SteppedSession'
import { getExercises, getWorkoutTemplate } from '../db'
import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'

function majorityCategory(steps) {
  const counts = {}
  for (const step of steps) counts[step.category] = (counts[step.category] ?? 0) + 1
  let best = steps[0]?.category ?? 'kettlebell'
  let bestCount = 0
  for (const [category, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }
  return best
}

export default function Tracker() {
  const navigate = useNavigate()
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
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-semibold">Tracker</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          No active workout. Start one from Library or Builder.
        </p>
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

  if (allExercises === undefined || (templateId && template === undefined)) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      </section>
    )
  }

  if (templateId && template === null) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-semibold">Tracker</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Template not found.</p>
        <Link to="/library" className={primaryButtonClass}>
          Back to Library
        </Link>
      </section>
    )
  }

  const exercisesById = new Map(allExercises.map((ex) => [ex.id, ex]))
  const exerciseIds = template ? template.exerciseIds : builderExerciseIds
  const steps = exerciseIds.map((id) => exercisesById.get(id)).filter(Boolean)
  const workoutName = template ? template.name : 'On-the-fly Workout'

  if (steps.length === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-semibold">{workoutName}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">This workout has no exercises.</p>
        <Link to="/library" className={primaryButtonClass}>
          Back to Library
        </Link>
      </section>
    )
  }

  const isOpenWorkSession = template?.category === 'kettlebell'
  const category = template ? template.category : majorityCategory(steps)

  const handleEnd = ({ durationSeconds, setsCompleted = null }) => {
    navigate('/log', {
      state: {
        source: 'tracker-end',
        templateId: template ? template.id : null,
        workoutName,
        category,
        durationSeconds,
        setsCompleted,
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="w-11" aria-hidden="true" />
        <h1 className="text-center text-xl font-semibold">{workoutName}</h1>
        <MuteToggle />
      </div>
      {isOpenWorkSession ? (
        <OpenWorkSession
          exercises={steps}
          sessionTargetSeconds={template.sessionTargetSeconds}
          onEnd={handleEnd}
        />
      ) : (
        <SteppedSession steps={steps} onEnd={handleEnd} />
      )}
    </div>
  )
}
