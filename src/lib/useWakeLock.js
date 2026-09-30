import { useEffect, useRef, useState } from 'react'

/**
 * Holds a screen wake lock while `active` is true, and returns whether one is
 * currently held - which the Tracker shows as a "Screen on" indicator, since
 * there is otherwise no way to tell a working lock from a denied one on a phone.
 *
 * Call this from the app-level session provider, not the Tracker page: the page
 * unmounts on a tab switch, and an active workout should keep the screen on
 * whichever tab is showing.
 */
export function useWakeLock(active) {
  const sentinelRef = useRef(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined
    let cancelled = false

    async function acquire() {
      if (cancelled || document.visibilityState !== 'visible') return
      if (sentinelRef.current && !sentinelRef.current.released) return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
          return
        }
        sentinelRef.current = sentinel
        setLocked(true)
        sentinel.addEventListener('release', () => setLocked(false))
      } catch {
        // Denied (low power mode, no user activation yet, a hidden document) -
        // the two listeners below give it another chance.
      }
    }

    // The OS drops the lock whenever the page is hidden, and never re-takes it.
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    // Some states reject a request made without a recent user gesture, so retry
    // on the next tap rather than leaving the screen to sleep for the session.
    const onPointer = () => acquire()

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('pointerdown', onPointer)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('pointerdown', onPointer)
      sentinelRef.current?.release().catch(() => {})
      sentinelRef.current = null
      setLocked(false)
    }
  }, [active])

  return locked
}
