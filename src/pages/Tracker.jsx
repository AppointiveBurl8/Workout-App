import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MuteToggle from '../components/tracker/MuteToggle'
import OpenWorkSession from '../components/tracker/OpenWorkSession'
import SteppedSession from '../components/tracker/SteppedSession'
import { getExercises, getWorkoutTemplate } from '../db'
import { majorityCategory, resolveSessionConfig } from '../lib/sessionConfig'
import { primaryButtonClass, secondaryButtonClass } from '../lib/ui'

function ActiveSession({ steps, initialConfig, onEnd }) {
  // The live config for this session. It lives above the step components so the
  // tap-to-adjust chips carry from one exercise to the next instead of resetting.
  const [config, setConfig] = useState(initialConfig)

  if (config.timerMode === 'open_work') {
    return (
      <OpenWorkSession
        exercises={steps}
        config={config.openWorkConfig}
        sideMode={config.sideMode}
        onConfigChange={(openWorkConfig) => setConfig({ ...config, openWorkConfig })}
        onEnd={onEnd}
      />
    )
  }

  const isInterval = config.timerMode === 'interval'
  return (
    <SteppedSession
      steps={steps}
      timerMode={config.timerMode}
      config={isInterval ? config.intervalConfig : config.pailsRailsConfig}
      onConfigChange={(next) =>
        setConfig(
          isInterval
            ? { ...config, intervalConfig: next }
            : { ...config, pailsRailsConfig: next },
        )
      }
      onEnd={onEnd}
    />
  )
}

export default function Tracker() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const templateId = searchParams.get('templateId')
  const session = location.state?.source === 'start' ? location.state : null

  const resolvedTemplateId = session?.templateId ?? (templateId ? Number(templateId) : null)

  const template = useLiveQuery(
    () => (resolvedTemplateId ? getWorkoutTemplate(resolvedTemplateId) : Promise.resolve(null)),
    [resolvedTemplateId],
  )
  const allExercises = useLiveQuery(() => getExercises(), [])

  if (!session && !resolvedTemplateId) {
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

  if (allExercises === undefined || (resolvedTemplateId && template === undefined)) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>
      </section>
    )
  }

  if (resolvedTemplateId && template === null && !session) {
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
  const exerciseIds = session?.exerciseIds ?? template?.exerciseIds ?? []
  const steps = exerciseIds.map((id) => exercisesById.get(id)).filter(Boolean)
  const workoutName = session?.workoutName ?? template?.name ?? 'On-the-fly Workout'

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

  const category = session?.category ?? template?.category ?? majorityCategory(steps)
  // Straight to /tracker (a refresh mid-session, or an old link) skips the Start
  // Workout screen, so fall back to whatever the template saved as its defaults.
  const initialConfig = session?.sessionConfig ?? resolveSessionConfig(template, category)

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
      <ActiveSession
        key={location.key}
        steps={steps}
        initialConfig={initialConfig}
        onEnd={handleEnd}
      />
    </div>
  )
}
