/**
 * Pure state-machine logic for the Tracker's stepped session modes (Interval,
 * Pails/Rails). Lives outside React so it can be driven by the app-level
 * activeSessionStore reducer instead of a per-component useReducer, which is what
 * lets a session survive navigating away from the Tracker tab and back.
 */

/** Brief transitional cues: not part of the "active" configured durations, so
 * they're excluded from the total-duration estimate on the Start Workout screen. */
export const SWITCH_SECONDS = 3 // Pails/Rails: PAILS hold -> RAILS hold direction change
export const TRANSITION_SECONDS = 10 // "Up Next" countdown between exercises
export const LEAD_IN_SECONDS = 10 // Get-into-position countdown before the first phase

// ---------------- Interval ----------------

export function initIntervalStepState(config) {
  return { phase: 'work', remainingSeconds: config.workSeconds, done: false }
}

function advanceIntervalPhase(state, config) {
  if (state.phase === 'work') {
    return { ...state, phase: 'rest', remainingSeconds: config.restSeconds }
  }
  // phase === 'rest' - one exercise's turn is over; the session decides what's next
  return { ...state, done: true, remainingSeconds: 0 }
}

export const INTERVAL_PHASE_LABELS = {
  work: 'Work',
  rest: 'Rest',
}

export const INTERVAL_PHASE_COLORS = {
  work: { label: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-600' },
  rest: { label: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-600' },
}

const INTERVAL_PHASE_CONFIG_FIELD = { work: 'workSeconds', rest: 'restSeconds' }

function intervalPhaseTotal(state, config) {
  return config[INTERVAL_PHASE_CONFIG_FIELD[state.phase]]
}

// ---------------- Pails/Rails ----------------

export function initPailsRailsStepState(config) {
  return { phase: 'stretch', remainingSeconds: config.holdSeconds, done: false }
}

function advancePailsRailsPhase(state, config) {
  const { rampSeconds, pailsHoldSeconds, railsHoldSeconds } = config
  switch (state.phase) {
    case 'stretch':
      return { ...state, phase: 'ramp', remainingSeconds: rampSeconds }
    case 'ramp':
      return { ...state, phase: 'pails', remainingSeconds: pailsHoldSeconds }
    case 'pails':
      return { ...state, phase: 'switch', remainingSeconds: SWITCH_SECONDS }
    case 'switch':
      return { ...state, phase: 'rails', remainingSeconds: railsHoldSeconds }
    case 'rails':
      return { ...state, done: true, remainingSeconds: 0 }
    default:
      return state
  }
}

export const PAILS_RAILS_PHASE_LABELS = {
  stretch: 'Stretch Hold',
  ramp: 'Ramp',
  pails: 'PAILs Hold',
  switch: 'Switch',
  rails: 'RAILs Hold',
}

/** Sustained holds get their own color; the brief ramp/switch transitions share a neutral one. */
export const PAILS_RAILS_PHASE_COLORS = {
  stretch: { label: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' },
  ramp: { label: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400 dark:bg-neutral-500' },
  pails: { label: 'text-green-600 dark:text-green-400', bar: 'bg-green-600' },
  switch: { label: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400 dark:bg-neutral-500' },
  rails: { label: 'text-red-600 dark:text-red-400', bar: 'bg-red-600' },
}

const PAILS_RAILS_PHASE_CONFIG_FIELD = {
  stretch: 'holdSeconds',
  ramp: 'rampSeconds',
  pails: 'pailsHoldSeconds',
  rails: 'railsHoldSeconds',
}

function pailsRailsPhaseTotal(state, config) {
  if (state.phase === 'switch') return SWITCH_SECONDS
  return config[PAILS_RAILS_PHASE_CONFIG_FIELD[state.phase]]
}

// ---------------- Shared dispatch by timer mode ----------------

const ENGINES = {
  interval: {
    init: initIntervalStepState,
    advance: advanceIntervalPhase,
    phaseTotal: intervalPhaseTotal,
    phaseConfigField: INTERVAL_PHASE_CONFIG_FIELD,
    labels: INTERVAL_PHASE_LABELS,
    colors: INTERVAL_PHASE_COLORS,
  },
  pails_rails: {
    init: initPailsRailsStepState,
    advance: advancePailsRailsPhase,
    phaseTotal: pailsRailsPhaseTotal,
    phaseConfigField: PAILS_RAILS_PHASE_CONFIG_FIELD,
    labels: PAILS_RAILS_PHASE_LABELS,
    colors: PAILS_RAILS_PHASE_COLORS,
  },
}

export function getStepEngine(timerMode) {
  return ENGINES[timerMode]
}

export function initStepState(timerMode, config) {
  return ENGINES[timerMode].init(config)
}

/** One second of real time passing. No-op once the step is done. */
export function tickStepState(timerMode, state, config) {
  if (state.done) return state
  const remainingSeconds = state.remainingSeconds - 1
  if (remainingSeconds > 0) return { ...state, remainingSeconds }
  return ENGINES[timerMode].advance(state, config)
}

/** Jumps straight to the next phase, as if the current one's timer had hit zero. */
export function skipStepState(timerMode, state, config) {
  if (state.done) return state
  return ENGINES[timerMode].advance(state, config)
}

export function stepPhaseTotal(timerMode, state, config) {
  return ENGINES[timerMode].phaseTotal(state, config)
}

/** Which config duration the current phase is counting down, or undefined for a fixed cue. */
export function stepPhaseConfigField(timerMode, phase) {
  return ENGINES[timerMode].phaseConfigField[phase]
}

export function stepPhaseLabel(timerMode, phase) {
  return ENGINES[timerMode].labels[phase]
}

export function stepPhaseColors(timerMode, phase) {
  return ENGINES[timerMode].colors[phase]
}

// ---------------- Session position: which exercise, which side ----------------

/**
 * A session is a circuit: a round is one pass through every exercise, so an
 * exercise's phase machine runs exactly one turn's worth of work and the session
 * decides what comes next. Both the round and the side therefore live on the
 * session, not inside any movement's machine.
 *
 * The nesting is round -> side -> exercise. A round covers both sides:
 *
 *   Round 1:  left (a b c), right (a b c)
 *   Round 2:  left (a b c), right (a b c)
 */
export function isUnilateral(timerMode, config) {
  if (timerMode === 'pails_rails') return true
  if (timerMode === 'interval') return config.sideMode === 'unilateral'
  return false
}

export function initSessionSide(timerMode, config) {
  return isUnilateral(timerMode, config) ? 'left' : null
}

export function initSessionPosition(timerMode, config) {
  return { currentIndex: 0, round: 1, side: initSessionSide(timerMode, config) }
}

/** Where the session goes once the current exercise's phase machine finishes. */
export function advanceSessionPosition({ currentIndex, round, side, exerciseCount, rounds, unilateral }) {
  if (currentIndex < exerciseCount - 1) {
    return { currentIndex: currentIndex + 1, round, side, done: false }
  }
  if (unilateral && side === 'left') {
    return { currentIndex: 0, round, side: 'right', done: false }
  }
  if (round < rounds) {
    return { currentIndex: 0, round: round + 1, side: unilateral ? 'left' : null, done: false }
  }
  return { currentIndex, round, side, done: true }
}

/** The mirror, for Previous. Null once there's nothing before the current spot. */
export function retreatSessionPosition({ currentIndex, round, side, exerciseCount, unilateral }) {
  if (currentIndex > 0) return { currentIndex: currentIndex - 1, round, side }
  if (unilateral && side === 'right') return { currentIndex: exerciseCount - 1, round, side: 'left' }
  if (round > 1) {
    return { currentIndex: exerciseCount - 1, round: round - 1, side: unilateral ? 'right' : null }
  }
  return null
}

/**
 * Whether a handover needs its own countdown screen. Interval ends every exercise
 * on its configured Rest, which already _is_ the gap between movements - putting a
 * countdown after it would just be resting twice over. Pails/Rails ends on a hold
 * with nothing after it, so it needs one. A side change always gets one either
 * way: that's a physical reposition, not a rest.
 */
export function needsTransitionCountdown(timerMode, fromSide, toSide) {
  if (fromSide !== toSide) return true
  return timerMode !== 'interval'
}

export const SIDE_LABELS = { left: 'Left side', right: 'Right side' }

// ---------------- Total duration estimate (item 5) ----------------

/**
 * Estimated total session length, recalculated live as chips change. Only sums the
 * user-configurable phase durations - the brief fixed switch/side-switch cues are
 * left out, same as they're excluded from the in-session phase-total progress bar.
 */
export function computeStepSessionDurationSeconds(timerMode, config, exerciseCount) {
  if (timerMode === 'interval') {
    const { workSeconds, restSeconds, rounds, sideMode } = config
    const sideMultiplier = sideMode === 'unilateral' ? 2 : 1
    return (workSeconds + restSeconds) * rounds * exerciseCount * sideMultiplier
  }
  if (timerMode === 'pails_rails') {
    const { holdSeconds, rampSeconds, pailsHoldSeconds, railsHoldSeconds, rounds } = config
    return (holdSeconds + rampSeconds + pailsHoldSeconds + railsHoldSeconds) * rounds * exerciseCount * 2
  }
  return null
}

// ---------------- Open Work (unchanged machine, just relocated) ----------------

export function initOpenWorkState() {
  return {
    phase: 'work', // 'work' | 'rest' | 'complete'
    workElapsedSeconds: 0,
    restRemainingSeconds: 0,
    sessionElapsedSeconds: 0,
    setsCompleted: 0,
  }
}

export function tickOpenWorkState(state, config) {
  if (state.phase === 'complete') return state
  const { sessionTargetSeconds } = config
  const sessionElapsedSeconds = state.sessionElapsedSeconds + 1
  if (sessionElapsedSeconds >= sessionTargetSeconds) {
    return { ...state, phase: 'complete', sessionElapsedSeconds: sessionTargetSeconds }
  }
  if (state.phase === 'work') {
    return { ...state, sessionElapsedSeconds, workElapsedSeconds: state.workElapsedSeconds + 1 }
  }
  const restRemainingSeconds = state.restRemainingSeconds - 1
  if (restRemainingSeconds <= 0) {
    return { ...state, sessionElapsedSeconds, phase: 'work', workElapsedSeconds: 0, restRemainingSeconds: 0 }
  }
  return { ...state, sessionElapsedSeconds, restRemainingSeconds }
}

export function endOpenWorkSet(state, restSeconds) {
  if (state.phase !== 'work') return state
  return { ...state, phase: 'rest', restRemainingSeconds: restSeconds, setsCompleted: state.setsCompleted + 1 }
}
