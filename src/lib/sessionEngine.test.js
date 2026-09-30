import { describe, expect, it } from 'vitest'
import {
  PREV_RESTART_THRESHOLD_MS,
  SWITCH_SECONDS,
  TRANSITION_SECONDS,
  buildPasses,
  buildStepSequence,
  computeStepSessionDurationSeconds,
  endOpenWorkSet,
  initOpenWorkState,
  resumeOpenWorkSet,
  retreatOpenWorkState,
  sessionSideMode,
  shouldRestartStep,
  sideLabelFor,
  stepCountsAsWorkoutTime,
  stepDurationSeconds,
  totalSessionSteps,
} from './sessionEngine'

const A = { name: 'A', sided: true }
const B = { name: 'B', sided: false } // symmetrical - runs once per round
const C = { name: 'C', sided: true }
const LEGACY = { name: 'L' } // a pre-v8 row with no flag at all

const INTERVAL = (over) => ({
  workSeconds: 30,
  restSeconds: 15,
  rounds: 2,
  sideMode: 'unilateral',
  ...over,
})
const PAILS = (over) => ({
  holdSeconds: 15,
  rampSeconds: 5,
  pailsHoldSeconds: 20,
  railsHoldSeconds: 20,
  rounds: 2,
  sideMode: 'unilateral',
  ...over,
})

/** A step as "round exercise side phase", for readable expectations. */
const label = (exercises, step) =>
  [
    `R${step.round}`,
    exercises[step.exerciseIndex].name,
    step.side ?? '',
    step.kind === 'transition' ? '→' : step.phase,
  ]
    .filter(Boolean)
    .join(' ')

const labels = (exercises, timerMode, config) =>
  buildStepSequence(exercises, timerMode, config).map((step) => label(exercises, step))

describe('buildPasses', () => {
  it('gives a unilateral session a left pass over everything and a right pass over the sided ones', () => {
    expect(buildPasses([A, B, C], 'unilateral')).toEqual([
      { side: 'left', indices: [0, 1, 2] },
      { side: 'right', indices: [0, 2] },
    ])
  })

  it('gives a bilateral session one unlabelled pass, flags ignored', () => {
    expect(buildPasses([A, B, C], 'bilateral')).toEqual([{ side: null, indices: [0, 1, 2] }])
  })

  it('collapses to one unlabelled pass when nothing is sided', () => {
    expect(buildPasses([B, { name: 'D', sided: false }], 'unilateral')).toEqual([
      { side: null, indices: [0, 1] },
    ])
  })

  it('treats a missing flag as sided', () => {
    expect(buildPasses([LEGACY], 'unilateral')).toEqual([
      { side: 'left', indices: [0] },
      { side: 'right', indices: [0] },
    ])
  })
})

describe('sideLabelFor', () => {
  it('labels a sided exercise with the pass it is in', () => {
    expect(sideLabelFor(A, { side: 'right', indices: [] })).toBe('right')
  })

  it('never labels a symmetrical one, even inside a labelled pass', () => {
    expect(sideLabelFor(B, { side: 'left', indices: [] })).toBeNull()
  })

  it('labels a missing flag as sided', () => {
    expect(sideLabelFor(LEGACY, { side: 'left', indices: [] })).toBe('left')
  })

  it('is null in an unlabelled pass', () => {
    expect(sideLabelFor(A, { side: null, indices: [] })).toBeNull()
  })
})

describe('buildStepSequence - Interval', () => {
  it('runs work then rest for each exercise, with no countdown between them', () => {
    expect(labels([A, C], 'interval', INTERVAL({ sideMode: 'bilateral', rounds: 1 }))).toEqual([
      'R1 A work',
      'R1 A rest',
      'R1 C work',
      'R1 C rest',
    ])
  })

  it('crosses a round boundary without a countdown when the side does not change', () => {
    expect(labels([A], 'interval', INTERVAL({ sideMode: 'bilateral', rounds: 2 }))).toEqual([
      'R1 A work',
      'R1 A rest',
      'R2 A work',
      'R2 A rest',
    ])
  })

  it('inserts a countdown only where the pass changes, and skips symmetrical exercises on the right', () => {
    expect(labels([A, B, C], 'interval', INTERVAL({ rounds: 2 }))).toEqual([
      'R1 A left work',
      'R1 A left rest',
      'R1 B work',
      'R1 B rest',
      'R1 C left work',
      'R1 C left rest',
      'R1 A right →',
      'R1 A right work',
      'R1 A right rest',
      'R1 C right work',
      'R1 C right rest',
      'R2 A left →',
      'R2 A left work',
      'R2 A left rest',
      'R2 B work',
      'R2 B rest',
      'R2 C left work',
      'R2 C left rest',
      'R2 A right →',
      'R2 A right work',
      'R2 A right rest',
      'R2 C right work',
      'R2 C right rest',
    ])
  })

  it('never opens the session on a countdown', () => {
    const first = buildStepSequence([A], 'interval', INTERVAL())[0]
    expect(first.kind).toBe('phase')
  })
})

describe('buildStepSequence - Pails/Rails', () => {
  it('runs the five phases in order, with a countdown before every exercise but the first', () => {
    expect(labels([A], 'pails_rails', PAILS({ rounds: 1 }))).toEqual([
      'R1 A left stretch',
      'R1 A left ramp',
      'R1 A left pails',
      'R1 A left switch',
      'R1 A left rails',
      'R1 A right →',
      'R1 A right stretch',
      'R1 A right ramp',
      'R1 A right pails',
      'R1 A right switch',
      'R1 A right rails',
    ])
  })

  it('gives a symmetrical exercise one turn per round and no side label', () => {
    const seq = labels([A, B], 'pails_rails', PAILS({ rounds: 1 }))
    // One turn: its own countdown plus five phases. Pails/Rails puts a countdown
    // before every exercise but the very first, symmetrical ones included.
    expect(seq.filter((l) => l.includes(' B ')).length).toBe(6)
    expect(seq.some((l) => l.includes('B left') || l.includes('B right'))).toBe(false)
    // Two turns for A: 5 phases opening the session, then a countdown + 5 on the right.
    expect(seq.filter((l) => l.startsWith('R1 A')).length).toBe(11)
  })

  it('runs a single unlabelled pass when nothing is sided', () => {
    const seq = labels([B], 'pails_rails', PAILS({ rounds: 2 }))
    expect(seq).toEqual([
      'R1 B stretch', 'R1 B ramp', 'R1 B pails', 'R1 B switch', 'R1 B rails',
      'R2 B →',
      'R2 B stretch', 'R2 B ramp', 'R2 B pails', 'R2 B switch', 'R2 B rails',
    ])
  })
})

describe('stepDurationSeconds', () => {
  const steps = buildStepSequence([A], 'pails_rails', PAILS({ rounds: 1 }))
  const config = PAILS()

  it('reads each phase off the config', () => {
    const byPhase = Object.fromEntries(
      steps
        .filter((s) => s.kind === 'phase')
        .map((s) => [s.phase, stepDurationSeconds(s, 'pails_rails', config)]),
    )
    expect(byPhase).toEqual({ stretch: 15, ramp: 5, pails: 20, switch: SWITCH_SECONDS, rails: 20 })
  })

  it('uses the fixed countdown length for a transition', () => {
    const transition = steps.find((s) => s.kind === 'transition')
    expect(stepDurationSeconds(transition, 'pails_rails', config)).toBe(TRANSITION_SECONDS)
  })

  it('reads Interval work and rest off the config', () => {
    const interval = buildStepSequence([A], 'interval', INTERVAL({ rounds: 1 }))
    expect(stepDurationSeconds(interval[0], 'interval', INTERVAL())).toBe(30)
    expect(stepDurationSeconds(interval[1], 'interval', INTERVAL())).toBe(15)
  })

  it('is 0 for no step at all, rather than throwing', () => {
    expect(stepDurationSeconds(undefined, 'interval', INTERVAL())).toBe(0)
  })
})

describe('what counts as workout time', () => {
  it('counts phases', () => {
    expect(stepCountsAsWorkoutTime({ kind: 'phase', phase: 'work' })).toBe(true)
  })

  it('does not count the between-exercise countdown', () => {
    expect(stepCountsAsWorkoutTime({ kind: 'transition' })).toBe(false)
  })

  it('a full Interval session bills exactly the configured work and rest', () => {
    const config = INTERVAL({ sideMode: 'bilateral', rounds: 2 })
    const billed = buildStepSequence([A, C], 'interval', config)
      .filter(stepCountsAsWorkoutTime)
      .reduce((sum, step) => sum + stepDurationSeconds(step, 'interval', config), 0)
    expect(billed).toBe((30 + 15) * 2 * 2)
  })
})

describe('Previous: restart or step back', () => {
  it('steps back within the first three seconds', () => {
    expect(shouldRestartStep(0)).toBe(false)
    expect(shouldRestartStep(1)).toBe(false)
    expect(shouldRestartStep(3)).toBe(false)
  })

  it('restarts the step after that', () => {
    expect(shouldRestartStep(4)).toBe(true)
    expect(shouldRestartStep(5)).toBe(true)
    expect(shouldRestartStep(120)).toBe(true)
  })

  it('turns on the named threshold, not a bare number', () => {
    expect(PREV_RESTART_THRESHOLD_MS).toBe(3000)
    expect(shouldRestartStep(PREV_RESTART_THRESHOLD_MS / 1000)).toBe(false)
    expect(shouldRestartStep(PREV_RESTART_THRESHOLD_MS / 1000 + 1)).toBe(true)
  })
})

describe('Open Work steps', () => {
  const config = { restSeconds: 60 }

  it('Next during a set ends it, counts it, and starts the rest', () => {
    const after = endOpenWorkSet({ ...initOpenWorkState(), workElapsedSeconds: 90 }, 60)
    expect(after.phase).toBe('rest')
    expect(after.restRemainingSeconds).toBe(60)
    expect(after.setsCompleted).toBe(1)
  })

  it('Next during a rest goes straight back to work', () => {
    const resting = { ...initOpenWorkState(), phase: 'rest', restRemainingSeconds: 40, setsCompleted: 2 }
    const after = resumeOpenWorkSet(resting)
    expect(after.phase).toBe('work')
    expect(after.workElapsedSeconds).toBe(0)
    expect(after.setsCompleted).toBe(2) // Next is not an un-count
  })

  it('Previous during a set restarts the set clock', () => {
    const working = { ...initOpenWorkState(), workElapsedSeconds: 90, setsCompleted: 3 }
    const after = retreatOpenWorkState(working, config.restSeconds)
    expect(after.phase).toBe('work')
    expect(after.workElapsedSeconds).toBe(0)
    expect(after.setsCompleted).toBe(3)
  })

  it('Previous well into a rest restarts the rest', () => {
    const resting = { ...initOpenWorkState(), phase: 'rest', restRemainingSeconds: 20, setsCompleted: 2 }
    const after = retreatOpenWorkState(resting, 60) // 40s elapsed
    expect(after.phase).toBe('rest')
    expect(after.restRemainingSeconds).toBe(60)
    expect(after.setsCompleted).toBe(2)
  })

  it('Previous just after starting a rest backs out of it and un-counts the set', () => {
    const resting = { ...initOpenWorkState(), phase: 'rest', restRemainingSeconds: 58, setsCompleted: 2 }
    const after = retreatOpenWorkState(resting, 60) // 2s elapsed
    expect(after.phase).toBe('work')
    expect(after.setsCompleted).toBe(1)
  })

  it('never drives the set count below zero', () => {
    const resting = { ...initOpenWorkState(), phase: 'rest', restRemainingSeconds: 60, setsCompleted: 0 }
    expect(retreatOpenWorkState(resting, 60).setsCompleted).toBe(0)
  })
})

describe('the duration estimate agrees with the session it estimates', () => {
  const cases = [
    ['all sided, pails/rails', [A, { name: 'B', sided: true }, C], 'pails_rails', PAILS()],
    ['middle unsided, pails/rails', [A, B, C], 'pails_rails', PAILS()],
    ['none sided, pails/rails', [B, { name: 'D', sided: false }], 'pails_rails', PAILS()],
    ['unilateral interval', [A, B, C], 'interval', INTERVAL()],
    ['bilateral interval', [A, B, C], 'interval', INTERVAL({ sideMode: 'bilateral' })],
    ['legacy rows with no flag', [LEGACY, LEGACY], 'interval', INTERVAL()],
  ]

  const perStep = {
    interval: (c) => c.workSeconds + c.restSeconds,
    pails_rails: (c) => c.holdSeconds + c.rampSeconds + c.pailsHoldSeconds + c.railsHoldSeconds,
  }
  const phasesPerExercise = { interval: 2, pails_rails: 5 }

  for (const [labelText, exercises, timerMode, config] of cases) {
    it(`${labelText}: estimate === the exercise turns the step list actually contains`, () => {
      const sequence = buildStepSequence(exercises, timerMode, config)
      const turns = sequence.filter((s) => s.kind === 'phase').length / phasesPerExercise[timerMode]
      const passes = buildPasses(exercises, sessionSideMode(timerMode, config))
      expect(totalSessionSteps(passes, config.rounds)).toBe(turns)
      expect(computeStepSessionDurationSeconds(timerMode, config, exercises)).toBe(
        turns * perStep[timerMode](config),
      )
    })
  }

  it('unticking one exercise of three shortens a unilateral estimate by one turn per round', () => {
    const allSided = computeStepSessionDurationSeconds('pails_rails', PAILS(), [
      A,
      { name: 'B', sided: true },
      C,
    ])
    const oneUnsided = computeStepSessionDurationSeconds('pails_rails', PAILS(), [A, B, C])
    expect(allSided - oneUnsided).toBe(perStep.pails_rails(PAILS()) * PAILS().rounds)
  })

  it('is null for Open Work, which runs to its own target', () => {
    expect(computeStepSessionDurationSeconds('open_work', {}, [A])).toBeNull()
  })

  it('and Open Work has no step list to build', () => {
    expect(buildStepSequence([A], 'open_work', { rounds: 1 })).toEqual([])
  })
})
