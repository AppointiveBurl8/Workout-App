import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { getSetting, setSetting } from '../db'
import {
  LEAD_IN_SECONDS,
  TRANSITION_SECONDS,
  advanceSessionPosition,
  endOpenWorkSet,
  initOpenWorkState,
  initSessionPosition,
  initStepState,
  isUnilateral,
  needsTransitionCountdown,
  retreatSessionPosition,
  skipStepState,
  stepPhaseConfigField,
  tickOpenWorkState,
  tickStepState,
} from './sessionEngine'

const STORAGE_KEY = 'activeSession'

/** Bumped when the stored session's shape changes in a way an older mirrored
 * copy can't be read as. A mismatch is dropped rather than half-restored. */
const SESSION_SHAPE = 3
const PERSIST_INTERVAL_MS = 3000
const IDLE_SESSION = { status: 'idle' }

const ActiveSessionContext = createContext(null)

function configFor(timerMode, config) {
  if (timerMode === 'interval') return config.intervalConfig
  if (timerMode === 'pails_rails') return config.pailsRailsConfig
  return config.openWorkConfig
}

function freshStepState(state) {
  return initStepState(state.timerMode, configFor(state.timerMode, state.config))
}

function sessionPosition(state) {
  const modeConfig = configFor(state.timerMode, state.config)
  return {
    currentIndex: state.currentIndex,
    round: state.round,
    side: state.side,
    exerciseCount: state.exerciseIds.length,
    rounds: modeConfig.rounds,
    unilateral: isUnilateral(state.timerMode, modeConfig),
  }
}

/** Move to a slot in the circuit, always restarting that exercise's phase machine. */
function atPosition(state, position) {
  const moved = {
    ...state,
    currentIndex: position.currentIndex,
    round: position.round,
    side: position.side,
  }
  return {
    ...moved,
    stepState: freshStepState(moved),
    transitioning: false,
    transitionRemaining: TRANSITION_SECONDS,
    pendingPosition: null,
  }
}

/** The current exercise has finished: hand over to the next slot, or end the session. */
function afterExercise(state, stepState, sessionElapsedSeconds) {
  const next = advanceSessionPosition(sessionPosition(state))
  const base = { ...state, stepState, sessionElapsedSeconds }
  if (next.done) {
    return {
      ...base,
      status: 'complete',
      completion: { durationSeconds: sessionElapsedSeconds, setsCompleted: null },
    }
  }
  if (!needsTransitionCountdown(state.timerMode, state.side, next.side)) {
    return atPosition(base, next)
  }
  return { ...base, transitioning: true, transitionRemaining: TRANSITION_SECONDS, pendingPosition: next }
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.session ?? state

    case 'START_SESSION': {
      const { templateId, workoutName, category, exerciseIds, timerMode, config } = action
      const base = {
        status: 'active',
        shape: SESSION_SHAPE,
        templateId: templateId ?? null,
        workoutName,
        category,
        exerciseIds,
        timerMode,
        config,
        started: false,
        paused: false,
        sessionElapsedSeconds: 0,
        transitioning: false,
        transitionRemaining: TRANSITION_SECONDS,
        leadIn: false,
        leadInRemaining: LEAD_IN_SECONDS,
        ...initSessionPosition(timerMode, configFor(timerMode, config)),
        pendingPosition: null,
        completion: null,
      }
      return timerMode === 'open_work'
        ? { ...base, openWork: initOpenWorkState() }
        : { ...base, stepState: initStepState(timerMode, configFor(timerMode, config)) }
    }

    // The tap that actually starts the workout - nothing ticks before this (item 7).
    // Interval and Pails/Rails open on a lead-in countdown: both begin in a held
    // position, and you can't be in it at the same moment you tap the button.
    case 'START': {
      if (state.status !== 'active') return state
      const running = { ...state, started: true, paused: false }
      if (state.timerMode === 'open_work') return running
      return { ...running, leadIn: true, leadInRemaining: LEAD_IN_SECONDS }
    }

    case 'TOGGLE_PAUSE':
      if (state.status !== 'active' || !state.started) return state
      return { ...state, paused: !state.paused }

    case 'TICK': {
      if (state.status !== 'active' || !state.started || state.paused) return state

      if (state.timerMode === 'open_work') {
        const openWork = tickOpenWorkState(state.openWork, state.config.openWorkConfig)
        if (openWork.phase === 'complete') {
          return {
            ...state,
            openWork,
            status: 'complete',
            completion: {
              durationSeconds: openWork.sessionElapsedSeconds,
              setsCompleted: openWork.setsCompleted,
            },
          }
        }
        return { ...state, openWork }
      }

      // Counts down before the first phase, so it neither advances the exercise
      // nor accumulates session time - the step is already sitting at its full
      // configured duration waiting to start.
      if (state.leadIn) {
        if (state.leadInRemaining <= 1) {
          return { ...state, leadIn: false, leadInRemaining: LEAD_IN_SECONDS }
        }
        return { ...state, leadInRemaining: state.leadInRemaining - 1 }
      }

      if (state.transitioning) {
        if (state.transitionRemaining <= 1) return atPosition(state, state.pendingPosition)
        return { ...state, transitionRemaining: state.transitionRemaining - 1 }
      }

      const modeConfig = configFor(state.timerMode, state.config)
      const nextStep = tickStepState(state.timerMode, state.stepState, modeConfig)
      const sessionElapsedSeconds = state.sessionElapsedSeconds + 1
      if (nextStep.done) return afterExercise(state, nextStep, sessionElapsedSeconds)
      return { ...state, stepState: nextStep, sessionElapsedSeconds }
    }

    // Jumps to the next phase within the current exercise (e.g. skip the rest of a
    // hold), as opposed to NEXT which moves to a different exercise entirely.
    case 'SKIP_PHASE': {
      if (state.status !== 'active' || state.timerMode === 'open_work' || state.transitioning) return state
      const modeConfig = configFor(state.timerMode, state.config)
      const nextStep = skipStepState(state.timerMode, state.stepState, modeConfig)
      if (nextStep.done) return afterExercise(state, nextStep, state.sessionElapsedSeconds)
      return { ...state, stepState: nextStep }
    }

    // Exercise-level stepping, one slot at a time along the session sequence: the
    // exercise list, repeated per round, and on a unilateral workout the whole of
    // that repeated once per side. So stepping forward off the last exercise of a
    // round lands on the first exercise of the next one, and off the last round of
    // the left pass onto the right - and Previous comes back the same way. Neither
    // wraps past the two real ends. Stepping always resets the new exercise's timer
    // to its configured starting value.
    case 'NEXT': {
      if (state.status !== 'active' || state.timerMode === 'open_work') return state
      if (state.transitioning) return atPosition(state, state.pendingPosition)
      const next = advanceSessionPosition(sessionPosition(state))
      if (next.done) return state
      return atPosition(state, next)
    }

    case 'PREV': {
      if (state.status !== 'active' || state.timerMode === 'open_work') return state
      const previous = retreatSessionPosition(sessionPosition(state))
      if (!previous) return state
      return atPosition(state, previous)
    }

    // The "Skip, I'm ready" control on the get-into-position screen.
    case 'SKIP_LEAD_IN':
      if (!state.leadIn) return state
      return { ...state, leadIn: false, leadInRemaining: LEAD_IN_SECONDS }

    // The "Skip wait, start now" control on the between-exercise Up Next screen.
    case 'SKIP_TRANSITION':
      if (!state.transitioning) return state
      return atPosition(state, state.pendingPosition)

    // A chip edit (Work/Rest/Hold/Rounds...). Retuning the phase currently running
    // shifts what's left of it by the same amount; editing Rounds clamps the current
    // round down if it's now out of range.
    case 'ADJUST_CONFIG': {
      if (state.status !== 'active' || state.timerMode === 'open_work') return state
      const modeKey = state.timerMode === 'interval' ? 'intervalConfig' : 'pailsRailsConfig'
      const oldConfig = state.config[modeKey]
      const { field, value } = action
      const newModeConfig = { ...oldConfig, [field]: value }
      let round = state.round
      let stepState = state.stepState
      if (field === 'rounds') {
        round = Math.min(round, value)
      } else {
        const runningField = stepPhaseConfigField(state.timerMode, stepState.phase)
        if (runningField === field) {
          stepState = {
            ...stepState,
            remainingSeconds: Math.max(1, stepState.remainingSeconds + (value - oldConfig[field])),
          }
        }
      }
      return { ...state, round, config: { ...state.config, [modeKey]: newModeConfig }, stepState }
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
      const durationSeconds =
        state.timerMode === 'open_work' ? state.openWork.sessionElapsedSeconds : state.sessionElapsedSeconds
      const setsCompleted = state.timerMode === 'open_work' ? state.openWork.setsCompleted : null
      return { ...state, status: 'complete', completion: { durationSeconds, setsCompleted } }
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

  useEffect(() => {
    if (session.status !== 'active' || !session.started || session.paused) return
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(id)
  }, [session.status, session.started, session.paused, dispatch])

  return (
    <ActiveSessionContext.Provider value={{ session, dispatch, hydrated }}>
      {children}
    </ActiveSessionContext.Provider>
  )
}

export function useActiveSession() {
  const ctx = useContext(ActiveSessionContext)
  if (!ctx) throw new Error('useActiveSession must be used within an ActiveSessionProvider')
  return ctx
}
