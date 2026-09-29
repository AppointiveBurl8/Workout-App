import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReorderableExerciseList from '../components/ReorderableExerciseList'
import ExercisePicker from '../components/ExercisePicker'
import TemplateEditor from '../components/TemplateEditor'
import { getExercises } from '../db'
import { unlockAudio } from '../lib/audioCues'
import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'

export default function Builder() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => getExercises(), [])
  const exercisesById = useMemo(
    () => new Map((exercises ?? []).map((ex) => [ex.id, ex])),
    [exercises],
  )

  const [exerciseIds, setExerciseIds] = useState([])
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  const addExerciseId = (id) => {
    setExerciseIds([...exerciseIds, id])
    setSavedMessage('')
  }

  const handleStartWorkout = () => {
    unlockAudio()
    navigate('/start', { state: { source: 'builder', exerciseIds } })
  }

  const handleSaveFormClose = (saved) => {
    setShowSaveForm(false)
    if (saved) setSavedMessage('Saved to Library.')
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Builder</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Add exercises, then start the workout or save it as a template for later.
      </p>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Exercises
        </p>
        {exerciseIds.length > 0 ? (
          <ReorderableExerciseList
            ids={exerciseIds}
            exercisesById={exercisesById}
            onChange={setExerciseIds}
            showCategory
          />
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No exercises added yet.</p>
        )}

        <div className="mt-3">
          <ExercisePicker exercises={exercises ?? []} onAdd={addExerciseId} />
        </div>
      </div>

      {savedMessage && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {savedMessage}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={handleStartWorkout}
          disabled={exerciseIds.length === 0}
        >
          Start Workout
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => setShowSaveForm(true)}>
          Save to Library
        </button>
      </div>

      {showSaveForm && (
        <TemplateEditor
          editingId="new"
          initialExerciseIds={exerciseIds}
          onClose={handleSaveFormClose}
        />
      )}
    </div>
  )
}
