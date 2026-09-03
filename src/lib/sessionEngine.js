/**
 * Pure state-machine logic for the Tracker's stepped session modes (Interval,
 * Pails/Rails). Lives outside React so it can be driven by the app-level
 * activeSessionStore reducer instead of a per-component useReducer, which is what
 * lets a session survive navigating away from the Tracker tab and back.
 */

/** Brief transitional cues: not part of the "active" configured durations, so
 * they're excluded from the total-duration estimate on the Start Workout screen. */
export const SWITCH_SECONDS = 3 // Pails/Rails: PAILS hold -> RAILS hold direction change
export const SIDE_SWITCH_SECONDS = 3 // Left pass -> Right pass, when sideMode is unilateral
export const TRANSITION_SECONDS = 10 // "Up Next" countdown between exercises

// ---------------- Interval ----------------

export function initIntervalStepState(config) {
  const side = config.sideMode === 'unilateral' ? 'left' : null
  return { phase: 'work', side, round: 1, remainingSeconds: config.workSeconds, done: false }
}

function advanceIntervalPhase(state, config) {
  const { workSeconds, restSeconds, rounds, sideMode } = config
  const unilateral = sideMode === 'unilateral'
  if (state.phase === 'work') {
    return { ...state, phase: 'rest', remainingSeconds: restSeconds }
  }
  if (state.phase === 'rest') {
    if (unilateral && state.side === 'left') {
      return { ...state, phase: 'side_switch', side: null, remainingSeconds: SIDE_SWITCH_SECONDS }
    }
    if (state.round < rounds) {
      return {
        ...state,
        phase: 'work',
        side: unilateral ? 'left' : null,
        round: state.round + 1,
        remainingSeconds: workSeconds,
      }
    }
    return { ...state, done: true, remainingSeconds: 0 }
  }
  // phase === 'side_switch'
  return { ...state, phase: 'work', side: 'right', remainingSeconds: workSeconds }
}

export const INTERVAL_PHASE_LABELS = {
  work: 'Work',
  rest: 'Rest',
  side_switch: 'Switch',
}

export const INTERVAL_PHASE_COLORS = {
  work: { label: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-600' },
  rest: { label: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-600' },
  side_switch: { label: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400 dark:bg-neutral-500' },
}

const INTERVAL_PHASE_CONFIG_FIELD = { work: 'workSeconds', rest: 'restSeconds' }

function intervalPhaseTotal(state, config) {
  if (state.phase === 'side_switch') return SIDE_SWITCH_SECONDS
  return config[INTERVAL_PHASE_CONFIG_FIELD[state.phase]]
}

// ---------------- Pails/Rails ----------------

export function initPailsRailsStepState(config) {
  return { phase: 'stretch', side: 'left', round: 1, remainingSeconds: config.holdSeconds, done: false }
}

function advancePailsRailsPhase(state, config) {
  const { holdSeconds, rampSeconds, pailsHoldSeconds, railsHoldSeconds, rounds } = config
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
      if (state.side === 'left') {
        return { ...state, phase: 'side_switch', side: null, remainingSeconds: SIDE_SWITCH_SECONDS }
      }
      if (state.round < rounds) {
        return {
          ...state,
          phase: 'stretch',
          side: 'left',
          round: state.round + 1,
          remainingSeconds: holdSeconds,
        }
      }
      return { ...state, done: true, remainingSeconds: 0 }
    case 'side_switch':
      return { ...state, phase: 'stretch', side: 'right', remainingSeconds: holdSeconds }
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
  side_switch: 'Switch',
}

/** Sustained holds get their own color; the brief ramp/switch transitions share a neutral one. */
export const PAILS_RAILS_PHASE_COLORS = {
  stretch: { label: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' },
  ramp: { label: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400 dark:bg-neutral-500' },
  pails: { label: 'text-green-600 dark:text-green-400', bar: 'bg-green-600' },
  switch: { label: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400 dark:bg-neutral-500' },
  rails: { label: 'text-red-600 dark:text-red-400', bar: 'bg-red-600' },
  side_switch: { label: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400 dark:bg-neutral-500' },
}

const PAILS_RAILS_PHASE_CONFIG_FIELD = {
  stretch: 'holdSeconds',
  ramp: 'rampSeconds',
  pails: 'pailsHoldSeconds',
  rails: 'railsHoldSeconds',
}

function pailsRailsPhaseTotal(state, config) {
  if (state.phase === 'switch') return SWITCH_SECONDS
  if (state.phase === 'side_switch') return SIDE_SWITCH_SECONDS
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
