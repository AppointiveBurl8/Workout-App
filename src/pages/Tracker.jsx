import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getExercises } from '../db'

export default function Tracker() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const templateId = searchParams.get('templateId')
  const builderExerciseIds =
    location.state?.source === 'builder' ? location.state.exerciseIds : null

  const exercises = useLiveQuery(() => getExercises(), [])
  const exercisesById = new Map((exercises ?? []).map((ex) => [ex.id, ex]))

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">Tracker</h1>
      <p className="text-neutral-500 dark:text-neutral-400">Coming soon</p>
      {templateId && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">
          templateId: {templateId}
        </p>
      )}
      {builderExerciseIds && (
        <div className="mt-2 text-sm text-neutral-400 dark:text-neutral-500">
          <p>On-the-fly workout from Builder ({builderExerciseIds.length} exercises):</p>
          <ul>
            {builderExerciseIds.map((id, index) => (
              <li key={`${id}-${index}`}>{exercisesById.get(id)?.name ?? `#${id}`}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
