import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import MuteToggle from '../components/tracker/MuteToggle'
import OpenWorkSession from '../components/tracker/OpenWorkSession'
import SteppedSession from '../components/tracker/SteppedSession'
import { getExercises, getWorkoutTemplate } from '../db'
import { useActiveSession } from '../lib/activeSessionStore'
import { resolveSessionConfig } from '../lib/sessionConfig'
import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'

export default function Tracker() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('templateId')
  const resolvedTemplateId = templateId ? Number(templateId) : null

  const { session, dispatch, hydrated } = useActiveSession()
  const allExercises = useLiveQuery(() => getExercises(), [])
  const template = useLiveQuery(
    () => (resolvedTemplateId ? getWorkoutTemplate(resolvedTemplateId) : Promise.resolve(null)),
    [resolvedTemplateId],
  )

  const hasSession = session.status === 'active' || session.status === 'complete'
  const bootstrapped = useRef(false)

  // A direct /tracker?templateId= link (a refresh mid-session, or an old link) skips
  // the Start Workout screen - bootstrap a session from the template's saved
  // defaults, same as Start Workout would, still gated on an explicit Start tap.
  useEffect(() => {
    if (hasSession || !hydrated || bootstrapped.current) return
    if (!resolvedTemplateId || allExercises === undefined || template === undefined || template === null) return
    bootstrapped.current = true
    const exercisesById = new Map(allExercises.map((ex) => [ex.id, ex]))
    const exerciseIds = (template.exerciseIds ?? []).filter((id) => exercisesById.has(id))
    if (exerciseIds.length === 0) return
    const { timerMode, ...config } = resolveSessionConfig(template, template.category)
    dispatch({
      type: 'START_SESSION',
      templateId: template.id,
      workoutName: template.name,
      category: template.category,
      exerciseIds,
      timerMode,
      config,
    })
  }, [hasSession, hydrated, resolvedTemplateId, allExercises, template, dispatch])

  const handedOffRef = useRef(false)
  useEffect(() => {
    if (session.status === 'idle') handedOffRef.current = false
  }, [session.status])
  useEffect(() => {
    if (session.status !== 'complete' || handedOffRef.current) return
    handedOffRef.current = true
    navigate('/log', {
      state: {
        source: 'tracker-end',
        templateId: session.templateId,
        workoutName: session.workoutName,
        category: session.category,
        durationSeconds: session.completion.durationSeconds,
        setsCompleted: session.completion.setsCompleted,
      },
    })
    dispatch({ type: 'CLEAR' })
  }, [session, navigate, dispatch])

  if (!hydrated || allExercises === undefined) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      </section>
    )
  }

  if (!hasSession) {
    if (resolvedTemplateId && template === null) {
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

  const exercisesById = new Map(allExercises.map((ex) => [ex.id, ex]))
  const steps = session.exerciseIds.map((id) => exercisesById.get(id)).filter(Boolean)

  if (steps.length === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-semibold">{session.workoutName}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">This workout has no exercises.</p>
        <Link to="/library" className={primaryButtonClass}>
          Back to Library
        </Link>
      </section>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="w-11" aria-hidden="true" />
        <h1 className="text-center text-xl font-semibold">{session.workoutName}</h1>
        <MuteToggle />
      </div>
      {session.timerMode === 'open_work' ? (
        <OpenWorkSession exercises={steps} session={session} dispatch={dispatch} />
      ) : (
        <SteppedSession steps={steps} session={session} dispatch={dispatch} />
      )}
    </div>
  )
}
