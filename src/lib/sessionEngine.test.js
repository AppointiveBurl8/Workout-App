import { describe, expect, it } from 'vitest'
import {
  advanceSessionPosition,
  buildPasses,
  computeStepSessionDurationSeconds,
  initSessionPosition,
  resolvePosition,
  retreatSessionPosition,
  sessionSideMode,
  sideLabelFor,
  totalSessionSteps,
} from './sessionEngine'

const A = { name: 'A', sided: true }
const B = { name: 'B', sided: false } // symmetrical - runs once per round
const C = { name: 'C', sided: true }
const LEGACY = { name: 'L' } // a pre-v8 row with no flag at all

const INTERVAL = (over) => ({ workSeconds: 30, restSeconds: 15, rounds: 2, sideMode: 'unilateral', ...over })
const PAILS = (over) => ({
  holdSeconds: 15,
  rampSeconds: 5,
  pailsHoldSeconds: 20,
  railsHoldSeconds: 20,
  rounds: 2,
  sideMode: 'unilateral',
  ...over,
})

/** Walks a whole session the way the reducer does, and labels every step. */
function runSession(exercises, timerMode, config) {
  const passes = buildPasses(exercises, sessionSideMode(timerMode, config))
  let position = initSessionPosition()
  const steps = []
  for (let guard = 0; guard < 500; guard++) {
    const { exercise, side } = resolvePosition(exercises, passes, position)
    steps.push(`R${position.round} ${exercise.name}${side ? ` ${side}` : ''}`)
    const next = advanceSessionPosition({ ...position, passes, rounds: config.rounds })
    if (next.done) return steps
    position = next
  }
  throw new Error('session never finished')
}

describe('buildPasses', () => {
  it('gives a unilateral session a left pass over everything and a right pass over the sided ones', () => {
    const passes = buildPasses([A, B, C], 'unilateral')
    expect(passes).toEqual([
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

describe('a whole session, step by step', () => {
  it('all sided: left a b c, right a b c, per round', () => {
    expect(runSession([A, { name: 'B', sided: true }, C], 'pails_rails', PAILS())).toEqual([
      'R1 A left', 'R1 B left', 'R1 C left',
      'R1 A right', 'R1 B right', 'R1 C right',
      'R2 A left', 'R2 B left', 'R2 C left',
      'R2 A right', 'R2 B right', 'R2 C right',
    ])
  })

  it('middle unsided: it runs once, in the left pass, and the right pass skips it', () => {
    expect(runSession([A, B, C], 'pails_rails', PAILS())).toEqual([
      'R1 A left', 'R1 B', 'R1 C left',
      'R1 A right', 'R1 C right',
      'R2 A left', 'R2 B', 'R2 C left',
      'R2 A right', 'R2 C right',
    ])
  })

  it('none sided: one pass per round, no side labels anywhere', () => {
    const D = { name: 'D', sided: false }
    expect(runSession([B, D], 'pails_rails', PAILS())).toEqual([
      'R1 B', 'R1 D', 'R2 B', 'R2 D',
    ])
  })

  it('bilateral Interval ignores the flags entirely', () => {
    expect(runSession([A, B, C], 'interval', INTERVAL({ sideMode: 'bilateral' }))).toEqual([
      'R1 A', 'R1 B', 'R1 C', 'R2 A', 'R2 B', 'R2 C',
    ])
  })

  it('unilateral Interval honours them the same as Pails/Rails', () => {
    expect(runSession([A, B, C], 'interval', INTERVAL({ rounds: 1 }))).toEqual([
      'R1 A left', 'R1 B', 'R1 C left', 'R1 A right', 'R1 C right',
    ])
  })
})

describe('stepping forward and back across every boundary', () => {
  const exercises = [A, B, C]
  const config = PAILS()
  const passes = buildPasses(exercises, 'unilateral')

  /** Every position the session visits, in order. */
  const walk = () => {
    let position = initSessionPosition()
    const all = [position]
    for (let i = 0; i < 100; i++) {
      const next = advanceSessionPosition({ ...position, passes, rounds: config.rounds })
      if (next.done) break
      position = { round: next.round, passIndex: next.passIndex, indexInPass: next.indexInPass }
      all.push(position)
    }
    return all
  }

  it('Previous retraces Next exactly, every step of the way', () => {
    const forward = walk()
    for (let i = forward.length - 1; i > 0; i--) {
      expect(retreatSessionPosition({ ...forward[i], passes })).toEqual(forward[i - 1])
    }
  })

  it('Next off the end of the left pass lands on the right pass', () => {
    const atEndOfLeft = { round: 1, passIndex: 0, indexInPass: 2 }
    expect(advanceSessionPosition({ ...atEndOfLeft, passes, rounds: 2 })).toEqual({
      round: 1,
      passIndex: 1,
      indexInPass: 0,
      done: false,
    })
  })

  it('Previous from the first exercise of the right pass goes to the last of the left', () => {
    expect(retreatSessionPosition({ round: 1, passIndex: 1, indexInPass: 0, passes })).toEqual({
      round: 1,
      passIndex: 0,
      indexInPass: 2,
    })
  })

  it('Next off the end of a round starts the next round on the left', () => {
    const atEndOfRound = { round: 1, passIndex: 1, indexInPass: 1 }
    expect(advanceSessionPosition({ ...atEndOfRound, passes, rounds: 2 })).toEqual({
      round: 2,
      passIndex: 0,
      indexInPass: 0,
      done: false,
    })
  })

  it('Previous from the start of a round goes back to the end of the previous one', () => {
    expect(retreatSessionPosition({ round: 2, passIndex: 0, indexInPass: 0, passes })).toEqual({
      round: 1,
      passIndex: 1,
      indexInPass: 1,
    })
  })

  it('Previous is null at the very start of the session', () => {
    expect(retreatSessionPosition({ round: 1, passIndex: 0, indexInPass: 0, passes })).toBeNull()
  })

  it('Next reports done at the very end, without moving', () => {
    const last = { round: 2, passIndex: 1, indexInPass: 1 }
    expect(advanceSessionPosition({ ...last, passes, rounds: 2 })).toEqual({ ...last, done: true })
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

  for (const [label, exercises, timerMode, config] of cases) {
    it(`${label}: estimate === steps actually generated × the per-step duration`, () => {
      const generated = runSession(exercises, timerMode, config).length
      const passes = buildPasses(exercises, sessionSideMode(timerMode, config))
      expect(totalSessionSteps(passes, config.rounds)).toBe(generated)
      expect(computeStepSessionDurationSeconds(timerMode, config, exercises)).toBe(
        generated * perStep[timerMode](config),
      )
    })
  }

  it('unticking one exercise of three shortens a unilateral estimate by one step per round', () => {
    const allSided = computeStepSessionDurationSeconds(
      'pails_rails',
      PAILS(),
      [A, { name: 'B', sided: true }, C],
    )
    const oneUnsided = computeStepSessionDurationSeconds('pails_rails', PAILS(), [A, B, C])
    const perRound = perStep.pails_rails(PAILS())
    expect(allSided - oneUnsided).toBe(perRound * PAILS().rounds)
  })

  it('is null for Open Work, which runs to its own target', () => {
    expect(computeStepSessionDurationSeconds('open_work', {}, [A])).toBeNull()
  })
})
