import { useEffect, useRef } from 'react'

const POLL_MS = 250

/**
 * Calls `onTicks(n)` with the number of whole `stepMs` steps of *real* time that
 * have passed since the last call.
 *
 * Counting interval callbacks under-counts: a backgrounded or throttled page
 * stops getting them, and a locked phone stops running JS entirely. Measuring
 * against `Date.now()` instead means the missed time is still there to be
 * claimed on the next poll, or immediately on the way back to visible.
 *
 * Time while `running` is false is discarded rather than banked - the effect
 * re-runs on resume and starts counting from then, so pausing never accrues.
 */
export function useWallClockTicker(onTicks, running, stepMs = 1000) {
  const savedCallback = useRef(onTicks)
  useEffect(() => {
    savedCallback.current = onTicks
  })

  useEffect(() => {
    if (!running) return undefined
    let last = Date.now()

    function flush() {
      const n = Math.floor((Date.now() - last) / stepMs)
      if (n > 0) {
        last += n * stepMs // keep the sub-step remainder, so ticks don't drift late
        savedCallback.current(n)
      }
    }

    const id = setInterval(flush, POLL_MS)
    // Coming back from hidden is the one moment the debt is certain to be large.
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [running, stepMs])
}
