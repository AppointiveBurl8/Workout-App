import { useState } from 'react'
import { audioStatus, playTone, setMuted, unlockAudio } from '../../lib/audioCues'
import { secondaryButtonClass } from '../../lib/ui'

/**
 * Timer cues fire from a timer, long after the tap that started the workout, which
 * is exactly the case phones are strictest about. When they don't come through
 * there's nothing on screen to say why - this turns that into one tap.
 */
export default function SoundCheck() {
  const [result, setResult] = useState(null)

  const test = () => {
    setMuted(false)
    unlockAudio()
    playTone('roundComplete')
    // Read the state after the unlock attempt, not before.
    setTimeout(() => setResult(audioStatus()), 300)
  }

  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm font-medium">Sound check</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Plays the round-complete cue and reports what this device allowed.
      </p>
      <button type="button" className={`${secondaryButtonClass} mt-3`} onClick={test}>
        Play test sound
      </button>

      {result && (
        <div className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
          {!result.supported && <p>This browser has no Web Audio at all — cues can never play here.</p>}
          {result.supported && result.state === 'running' && (
            <p>
              Audio is running. If you heard nothing, the sound is being blocked outside the app —
              on an iPhone the silent switch mutes this kind of audio even at full volume.
            </p>
          )}
          {result.supported && result.state !== 'running' && (
            <p>Audio is {result.state} — the browser hasn’t allowed it to start. Tap the button once more.</p>
          )}
          <p className="mt-1 text-neutral-500 dark:text-neutral-400">
            state: {result.state} · vibration: {result.canVibrate ? 'available' : 'not available'}
          </p>
        </div>
      )}
    </div>
  )
}
