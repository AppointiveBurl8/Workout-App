/**
 * Pure state-machine logic for the Tracker's stepped session modes (Interval,
 * Pails/Rails). Lives outside React so it can be driven by the app-level
 * activeSessionStore reducer instead of a per-component useReducer, which is what
 * lets a session survive navigating away from the Tracker tab and back.
 *
 * A session is a flat list of **steps** - the smallest timed units it contains -
 * built once by `buildStepSequence`. Round, pass, side, exercise, phase, colour
 * and the timer all derive from the step at the current index, so there is one
 * place that decides what comes next and nothing to keep in sync.
 */

/** Brief transitional cues: not part of the "active" configured durations, so
 * they're excluded from the total-duration estimate on the Start Workout screen. */
export const SWITCH_SECONDS = 3 // Pails/Rails: PAILS hold -> RAILS hold direction change
export const TRANSITION_SECONDS = 10 // "Up Next" countdown between exercises
export const LEAD_IN_SECONDS = 10 // Get-into-position countdown before the first phase

/**
 * How far into a step Previous stops meaning "back one" and starts meaning
 * "restart this one". Past this you almost certainly want the step you're in
 * again, not the one before it.
 */
export const PREV_RESTART_THRESHOLD_MS = 3000

// ---------------- Phases ----------------

export const INTERVAL_PHASE_LABELS = {
  work: 'Work',
  rest: 'Rest',
}

export const INTERVAL_PHASE_COLORS = {
  work: { label: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-600' },
  rest: { label: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-600' },
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

/** The phases one exercise runs through, in order, per mode. */
export const PHASE_SEQUENCE = {
  interval: ['work', 'rest'],
  pails_rails: ['stretch', 'ramp', 'pails', 'switch', 'rails'],
}

/** Which config duration each phase counts down. `switch` is a fixed cue, not configurable. */
const PHASE_CONFIG_FIELD = {
  interval: { work: 'workSeconds', rest: 'restSeconds' },
  pails_rails: {
    stretch: 'holdSeconds',
    ramp: 'rampSeconds',
    pails: 'pailsHoldSeconds',
    rails: 'railsHoldSeconds',
  },
}

export function stepPhaseLabel(timerMode, phase) {
  return timerMode === 'interval' ? INTERVAL_PHASE_LABELS[phase] : PAILS_RAILS_PHASE_LABELS[phase]
}

export function stepPhaseColors(timerMode, phase) {
  return timerMode === 'interval' ? INTERVAL_PHASE_COLORS[phase] : PAILS_RAILS_PHASE_COLORS[phase]
}

// ---------------- Passes: which side runs which exercises ----------------

/**
 * A session is a circuit, nested round -> pass -> exercise. A round is one pass
 * through the exercise list per side, so:
 *
 *   Round 1:  left (a b c) -> Switch Sides -> right (a b c)
 *
 * ...except that not every movement has two sides. An exercise with
 * `sided: false` is symmetrical and runs **once**, in the left pass, at its list
 * position; the right pass skips it. If nothing is sided there is one unlabelled
 * pass. A bilateral Interval workout ignores the flag entirely.
 */
export function isUnilateral(timerMode, config) {
  if (timerMode === 'pails_rails') return true
  if (timerMode === 'interval') return config.sideMode === 'unilateral'
  return false
}

export function sessionSideMode(timerMode, config) {
  return isUnilateral(timerMode, config) ? 'unilateral' : 'bilateral'
}

/** An exercise is two-sided unless it explicitly says otherwise, so an old row
 * with no flag at all keeps the behaviour it had before the flag existed. */
export function isSidedExercise(exercise) {
  return exercise?.sided !== false
}

/**
 * Which side passes a session needs, and which exercise indices run in each.
 * The single source of truth for sequencing - everything else derives from it.
 */
export function buildPasses(exercises, sideMode) {
  const all = exercises.map((_, i) => i)
  if (sideMode !== 'unilateral') return [{ side: null, indices: all }]
  const sided = all.filter((i) => isSidedExercise(exercises[i]))
  if (sided.length === 0) return [{ side: null, indices: all }]
  return [
    { side: 'left', indices: all },
    { side: 'right', indices: sided },
  ]
}

/** The side label an exercise shows during a pass. A symmetrical one shows none. */
export function sideLabelFor(exercise, pass) {
  return isSidedExercise(exercise) ? (pass?.side ?? null) : null
}

export function totalSessionSteps(passes, rounds) {
  return passes.reduce((n, pass) => n + pass.indices.length, 0) * rounds
}

export const SIDE_LABELS = { left: 'Left side', right: 'Right side' }

/**
 * Whether a handover needs its own countdown screen. Interval ends every exercise
 * on its configured Rest, which already _is_ the gap between movements - putting a
 * countdown after it would just be resting twice over. Pails/Rails ends on a hold
 * with nothing after it, so it needs one. Crossing a pass boundary always gets
 * one either way: that's a physical reposition, not a rest.
 */
export function needsTransitionCountdown(timerMode, fromPassIndex, toPassIndex) {
  if (fromPassIndex !== toPassIndex) return true
  return timerMode !== 'interval'
}

// ---------------- The step sequence ----------------

/**
 * Every timed unit the session will run, in order. A step is either:
 *
 * - `kind: 'phase'`   one phase of one exercise (Work, Rest; Stretch Hold, Ramp,
 *                     PAILs, Switch, RAILs), or
 * - `kind: 'transition'`  the "Up Next" / "Switch Sides" countdown that precedes
 *                     the exercise it introduces, where one is needed.
 *
 * A transition carries the position of the exercise it leads into, so the screen
 * can name what's coming without looking ahead.
 *
 * Structure only - durations are read from the live config at display time, so
 * retuning a chip mid-session doesn't invalidate the list. Only `rounds` changes
 * its length, and because it's round-major, growing rounds only appends.
 */
export function buildStepSequence(exercises, timerMode, config) {
  const phases = PHASE_SEQUENCE[timerMode]
  if (!phases) return []
  const passes = buildPasses(exercises, sessionSideMode(timerMode, config))
  const steps = []
  let previousPassIndex = null

  for (let round = 1; round <= config.rounds; round++) {
    passes.forEach((pass, passIndex) => {
      pass.indices.forEach((exerciseIndex, indexInPass) => {
        const at = {
          round,
          passIndex,
          indexInPass,
          exerciseIndex,
          side: sideLabelFor(exercises[exerciseIndex], pass),
        }
        // Nothing to transition from on the very first step of the session.
        if (steps.length > 0 && needsTransitionCountdown(timerMode, previousPassIndex, passIndex)) {
          steps.push({ ...at, kind: 'transition', phase: null })
        }
        for (const phase of phases) steps.push({ ...at, kind: 'phase', phase })
        previousPassIndex = passIndex
      })
    })
  }
  return steps
}

/** How long a step runs. Transitions and the Pails/Rails switch cue are fixed. */
export function stepDurationSeconds(step, timerMode, modeConfig) {
  if (!step) return 0
  if (step.kind === 'transition') return TRANSITION_SECONDS
  if (step.phase === 'switch') return SWITCH_SECONDS
  return modeConfig[PHASE_CONFIG_FIELD[timerMode][step.phase]]
}

/**
 * A transition is dead time between movements - the same as the lead-in - so it
 * isn't billed as workout time, and the logged duration counts only the phases
 * actually worked.
 */
export function stepCountsAsWorkoutTime(step) {
  return step?.kind === 'phase'
}

/**
 * Whether Previous should restart the current step rather than step back. Past
 * a few seconds in, you meant "give me that one again".
 */
export function shouldRestartStep(stepElapsedSeconds) {
  return stepElapsedSeconds * 1000 > PREV_RESTART_THRESHOLD_MS
}

// ---------------- Total duration estimate ----------------

/**
 * Estimated total session length, recalculated live as chips change. Only sums the
 * user-configurable phase durations - the brief fixed switch/transition cues are
 * left out, same as they're excluded from the in-session phase-total progress bar.
 *
 * Counts the steps the session will actually generate, via `buildPasses`, rather
 * than multiplying by two for a unilateral workout: a symmetrical exercise runs
 * once, and the estimate has to agree with the run or one of them is lying.
 */
export function computeStepSessionDurationSeconds(timerMode, config, exercises) {
  if (timerMode !== 'interval' && timerMode !== 'pails_rails') return null
  const passes = buildPasses(exercises, sessionSideMode(timerMode, config))
  const steps = totalSessionSteps(passes, config.rounds)
  if (timerMode === 'interval') {
    return (config.workSeconds + config.restSeconds) * steps
  }
  const { holdSeconds, rampSeconds, pailsHoldSeconds, railsHoldSeconds } = config
  return (holdSeconds + rampSeconds + pailsHoldSeconds + railsHoldSeconds) * steps
}

// ---------------- Open Work ----------------

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

/** Rest over (or skipped): straight back into the next set. */
export function resumeOpenWorkSet(state) {
  if (state.phase !== 'work') {
    return { ...state, phase: 'work', workElapsedSeconds: 0, restRemainingSeconds: 0 }
  }
  return { ...state, workElapsedSeconds: 0 }
}

/**
 * Previous, in Open Work. A work block counts up with no set length, so there is
 * no earlier step to return to that would mean anything - Previous restarts it.
 * During rest it restarts the rest, or, if the rest only just began, drops back
 * into the set and un-counts it: that's the "tapped End Set by mistake" case.
 */
export function retreatOpenWorkState(state, restSeconds) {
  if (state.phase !== 'rest') return { ...state, workElapsedSeconds: 0 }
  const restElapsed = restSeconds - state.restRemainingSeconds
  if (shouldRestartStep(restElapsed)) {
    return { ...state, restRemainingSeconds: restSeconds }
  }
  return {
    ...state,
    phase: 'work',
    workElapsedSeconds: 0,
    restRemainingSeconds: 0,
    setsCompleted: Math.max(0, state.setsCompleted - 1),
  }
}
