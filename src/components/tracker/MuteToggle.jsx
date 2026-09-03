import { useState } from 'react'
import { isMuted, setMuted } from '../../lib/audioCues'

export default function MuteToggle() {
  const [muted, setMutedState] = useState(() => isMuted())

  const toggle = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Unmute sound cues' : 'Mute sound cues'}
      aria-pressed={muted}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg dark:bg-neutral-800"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
