import { useEffect, useRef } from 'react'

/** Ticks `callback` every `delayMs`. Pass `null` for delayMs to pause. */
export function useInterval(callback, delayMs) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delayMs === null) return
    const id = setInterval(() => savedCallback.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs])
}

/** Calls `callback` once, exactly when `trigger` becomes truthy (not on every render while it stays truthy). */
export function useOnceWhen(trigger, callback) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  })

  useEffect(() => {
    if (trigger) savedCallback.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
}
