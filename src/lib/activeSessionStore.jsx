import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { getSetting, setSetting } from '../db'
import {
  LEAD_IN_SECONDS,
  advanceAmrap,
  buildStepSequence,
  endOpenWorkSet,
  initAmrapState,
  initOpenWorkState,
  retreatAmrap,
  resumeOpenWorkSet,
  retreatOpenWorkState,
  shouldRestartStep,
  stepCountsAsWorkoutTime,
  stepDurationSeconds,
  tickAmrapState,
  tickOpenWorkState,
} from './sessionEngine'
import { useWakeLock } from './useWakeLock'
import { useWallClockTicker } from './useWallClockTicker'

const STORAGE_KEY = 'activeSession'

/** Bumped when the stored session's shape changes in a way an older mirrored
 * copy can't be read as. A mismatch is dropped rather than half-restored. */
const SESSION_SHAPE = 6
const PERSIST_INTERVAL_MS = 3000
const IDLE_SESSION = { status: 'idle' }

/** Ceiling on how much backgrounded time a returning page will replay. Past a
 * few hours the workout was abandoned, not backgrounded. */
const MAX_CATCHUP_SECONDS = 4 * 60 * 60

const ActiveSessionContext = createContext(null)

/** Whether a TICK would do anything. Also what stops a catch-up overshooting. */
function isTicking(state) {
  return state.status === 'active' && state.started && !state.paused
}

const CONFIG_KEY = {
  interval: 'intervalConfig',
  pails_rails: 'pailsRailsConfig',
  emom: 'emomConfig',
  amrap: 'amrapConfig',
  open_work: 'openWorkConfig',
}

function configFor(timerMode, config) {
  return config[CONFIG_KEY[timerMode]]
}

// The step list is structure only, so it changes just when `rounds` or the
// exercises' `sided` flags do - neither of which moves during a session except
// via a Rounds chip edit. Rebuilding it on every tick would mean rebuilding it
// 14,400 times during a long catch-up, so it's memoised on those inputs.
let cachedStepsKey = null
let cachedSteps = null

export function sessionSteps(state) {
  const modeConfig = configFor(state.timerMode, state.config)
  const key = [
    state.timerMode,
    modeConfig.rounds,
    modeConfig.sideMode ?? '',
    state.exercises.map((e) => (e.sided === false ? '0' : '1')).join(''),
  ].join('|')
  if (key !== cachedStepsKey) {
    cachedStepsKey = key
    cachedSteps = buildStepSequence(state.exercises, state.timerMode, modeConfig)
  }
  return cachedSteps
}

export function currentStep(state) {
  return sessionSteps(state)[state.stepIndex]
}

function completed(state, durationSeconds, setsCompleted = null, roundsCompleted = null) {
  return { ...state, status: 'complete', completion: { durationSeconds, setsCompleted, roundsCompleted } }
}

/**
 * The one place a step change happens. Next, Previous and a timer running out
 * all land here, so the round, side, phase and exercise on screen can never be
 * derived three different ways - they're read off the step this lands on.
 * Running off the end of the list completes the workout, by the same path a
 * timer finishing the last step takes.
 */
function goToStep(state, index) {
  if (index >= sessionSteps(state).length) {
    return completed(state, state.sessionElapsedSeconds)
  }
  return { ...state, stepIndex: Math.max(0, index), stepElapsedSeconds: 0 }
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.session ?? state

    case 'START_SESSION': {
      const { templateId, workoutName, category, exercises, timerMode, config } = action
      const base = {
        status: 'active',
        shape: SESSION_SHAPE,
        templateId: templateId ?? null,
        workoutName,
        category,
        // Snapshotted, not looked up live: the `sided` flags here decide the
        // circuit, and it must not change under a running workout.
        exercises: exercises.map((exercise) => ({ id: exercise.id, sided: exercise.sided !== false })),
        timerMode,
        config,
        started: false,
        paused: false,
        sessionElapsedSeconds: 0,
        leadIn: false,
        leadInRemaining: LEAD_IN_SECONDS,
        stepIndex: 0,
        stepElapsedSeconds: 0,
        completion: null,
      }
      if (timerMode === 'open_work') return { ...base, openWork: initOpenWorkState() }
      if (timerMode === 'amrap') return { ...base, amrap: initAmrapState() }
      return base
    }

    // The tap that actually starts the workout - nothing ticks before this.
    // Every mode but Open Work opens on a lead-in countdown: you can't be in
    // position, or have the bell in hand, at the same moment you tap the button.
    case 'START': {
      if (state.status !== 'active') return state
      const running = { ...state, started: true, paused: false }
      if (state.timerMode === 'open_work') return running
      return { ...running, leadIn: true, leadInRemaining: LEAD_IN_SECONDS }
    }

    case 'TOGGLE_PAUSE':
      if (state.status !== 'active' || !state.started) return state
      return { ...state, paused: !state.paused }

    // Several seconds owed at once, because the page was backgrounded, throttled,
    // or the phone was locked. Replayed one at a time through the single-tick path
    // below rather than jumping the clock, so every phase, round and side change -
    // and Open Work's hard stop - lands exactly where a foreground run would have
    // put it. The loop stops the moment the session isn't tickable any more, which
    // is what keeps a long catch-up from running past the end of the workout.
    case 'TICK_N': {
      const n = Math.min(action.n, MAX_CATCHUP_SECONDS)
      let next = state
      for (let i = 0; i < n; i++) {
        if (!isTicking(next)) break
        next = reducer(next, { type: 'TICK' })
      }
      return next
    }

    case 'TICK': {
      if (!isTicking(state)) return state

      if (state.timerMode === 'open_work') {
        const openWork = tickOpenWorkState(state.openWork, state.config.openWorkConfig)
        if (openWork.phase === 'complete') {
          return completed({ ...state, openWork }, openWork.sessionElapsedSeconds, openWork.setsCompleted)
        }
        return { ...state, openWork }
      }

      // Counts down before the first step, so it neither advances the session nor
      // accumulates workout time - step 0 is already sitting at its full
      // configured duration waiting to start.
      if (state.leadIn) {
        if (state.leadInRemaining <= 1) {
          return { ...state, leadIn: false, leadInRemaining: LEAD_IN_SECONDS }
        }
        return { ...state, leadInRemaining: state.leadInRemaining - 1 }
      }

      if (state.timerMode === 'amrap') {
        const amrap = tickAmrapState(state.amrap, state.config.amrapConfig)
        if (amrap.complete) {
          return completed({ ...state, amrap }, amrap.elapsedSeconds, null, amrap.roundsCompleted)
        }
        return { ...state, amrap }
      }

      const step = currentStep(state)
      const total = stepDurationSeconds(step, state.timerMode, configFor(state.timerMode, state.config))
      const stepElapsedSeconds = state.stepElapsedSeconds + 1
      const sessionElapsedSeconds =
        state.sessionElapsedSeconds + (stepCountsAsWorkoutTime(step) ? 1 : 0)
      if (stepElapsedSeconds >= total) {
        return goToStep({ ...state, sessionElapsedSeconds }, state.stepIndex + 1)
      }
      return { ...state, stepElapsedSeconds, sessionElapsedSeconds }
    }

    // Ends the current step and starts the next, wherever that lands - the next
    // phase, the next exercise, the next side, the next round, or the end of the
    // workout. Never a no-op and never disabled: there is always a "next".
    case 'NEXT': {
      if (state.status !== 'active' || !state.started) return state
      if (state.timerMode === 'open_work') {
        const { openWork, config } = state
        return {
          ...state,
          openWork:
            openWork.phase === 'work'
              ? endOpenWorkSet(openWork, config.openWorkConfig.restSeconds)
              : resumeOpenWorkSet(openWork),
        }
      }
      if (state.leadIn) return { ...state, leadIn: false, leadInRemaining: LEAD_IN_SECONDS }
      // AMRAP's step is a movement: Next marks it done, and the last one scores a round.
      if (state.timerMode === 'amrap') {
        return { ...state, amrap: advanceAmrap(state.amrap, state.exercises.length) }
      }
      return goToStep(state, state.stepIndex + 1)
    }

    // More than a few seconds into a step, Previous means "give me that one
    // again" rather than "take me back one" - by then you've committed to it.
    // On the first step there's nothing behind it, so it always restarts.
    case 'PREV': {
      if (state.status !== 'active' || !state.started) return state
      if (state.timerMode === 'open_work') {
        return {
          ...state,
          openWork: retreatOpenWorkState(state.openWork, state.config.openWorkConfig.restSeconds),
        }
      }
      if (state.leadIn) return { ...state, leadInRemaining: LEAD_IN_SECONDS }
      if (state.timerMode === 'amrap') {
        return { ...state, amrap: retreatAmrap(state.amrap, state.exercises.length) }
      }
      const restart = shouldRestartStep(state.stepElapsedSeconds)
      return goToStep(state, restart ? state.stepIndex : state.stepIndex - 1)
    }

    // A chip edit (Work/Rest/Hold/Rounds...). Durations are read off the config
    // at display time, so retuning one needs nothing here - what's elapsed stays
    // elapsed and the remaining time shifts with it. Rounds changes the length of
    // the step list, and cutting it below where we are has to land somewhere.
    case 'ADJUST_CONFIG': {
      if (state.status !== 'active' || state.timerMode === 'open_work') return state
      const modeKey = CONFIG_KEY[state.timerMode]
      const { field, value } = action
      const next = {
        ...state,
        config: { ...state.config, [modeKey]: { ...state.config[modeKey], [field]: value } },
      }
      if (field !== 'rounds' || state.timerMode === 'amrap') return next
      const steps = sessionSteps(next)
      if (next.stepIndex < steps.length) return next
      return { ...next, stepIndex: steps.length - 1, stepElapsedSeconds: 0 }
    }

    case 'ADJUST_OPEN_WORK_CONFIG': {
      if (state.status !== 'active' || state.timerMode !== 'open_work') return state
      const { field, value } = action
      const oldConfig = state.config.openWorkConfig
      const newConfig = { ...oldConfig, [field]: value }
      let openWork = state.openWork
      if (field === 'restSeconds' && openWork.phase === 'rest') {
        openWork = {
          ...openWork,
          restRemainingSeconds: Math.max(1, openWork.restRemainingSeconds + (value - oldConfig.restSeconds)),
        }
      }
      return { ...state, config: { ...state.config, openWorkConfig: newConfig }, openWork }
    }

    case 'END_SET':
      if (state.status !== 'active' || state.timerMode !== 'open_work') return state
      return { ...state, openWork: endOpenWorkSet(state.openWork, state.config.openWorkConfig.restSeconds) }

    case 'SET_SETS_COMPLETED':
      if (state.status !== 'active' || state.timerMode !== 'open_work') return state
      return { ...state, openWork: { ...state.openWork, setsCompleted: Math.max(0, action.value) } }

    case 'END_WORKOUT': {
      if (state.status !== 'active') return state
      if (state.timerMode === 'open_work') {
        return completed(state, state.openWork.sessionElapsedSeconds, state.openWork.setsCompleted)
      }
      if (state.timerMode === 'amrap') {
        return completed(state, state.amrap.elapsedSeconds, null, state.amrap.roundsCompleted)
      }
      return completed(state, state.sessionElapsedSeconds)
    }

    case 'CLEAR':
      return IDLE_SESSION

    default:
      return state
  }
}

export function ActiveSessionProvider({ children }) {
  const [session, dispatch] = useReducer(reducer, IDLE_SESSION)
  const [hydrated, setHydrated] = useState(false)
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Load whatever was mirrored to IndexedDB before this session, so a hard reload
  // (or the container restarting) doesn't lose an in-progress workout.
  useEffect(() => {
    let cancelled = false
    getSetting(STORAGE_KEY).then((stored) => {
      if (cancelled) return
      if (stored && stored.status === 'active' && stored.shape === SESSION_SHAPE) {
        dispatch({ type: 'HYDRATE', session: stored })
      }
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [dispatch])

  // Mirror active-session state to IndexedDB every few seconds - not on every tick,
  // that would mean a write a second while a workout is running.
  useEffect(() => {
    if (!hydrated) return
    const id = setInterval(() => {
      const current = sessionRef.current
      setSetting(STORAGE_KEY, current.status === 'active' ? current : null)
    }, PERSIST_INTERVAL_MS)
    return () => clearInterval(id)
  }, [hydrated])

  // Clear the mirrored copy as soon as a session ends, rather than waiting for the
  // next periodic write.
  useEffect(() => {
    if (!hydrated) return
    if (session.status !== 'active') setSetting(STORAGE_KEY, null)
  }, [hydrated, session.status])

  // Measured against the wall clock rather than counted, so time the page spent
  // backgrounded or throttled is recovered instead of lost. Rehydration from
  // IndexedDB deliberately does not catch up: the ticker starts fresh, so a
  // reload resumes from the last mirrored state rather than from when the
  // session began.
  useWallClockTicker((n) => dispatch({ type: 'TICK_N', n }), isTicking(session))

  // Keeps the screen awake for the whole session, paused and between-exercise
  // countdowns included - held here rather than in the Tracker page so switching
  // tabs mid-workout doesn't let the phone sleep.
  const screenLocked = useWakeLock(session.status === 'active')

  return (
    <ActiveSessionContext.Provider value={{ session, dispatch, hydrated, screenLocked }}>
      {children}
    </ActiveSessionContext.Provider>
  )
}

export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext)
  if (!ctx) throw new Error('useActiveSession must be used within an ActiveSessionProvider')
  return ctx
}
