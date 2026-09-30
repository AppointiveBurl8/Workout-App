const MUTE_STORAGE_KEY = 'workout-tracker:audio-muted'

let audioContext = null
let muted = readStoredMute()

function readStoredMute() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

export function setMuted(next) {
  muted = next
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(next))
  } catch {
    // localStorage unavailable (private browsing, full quota) - mute just won't persist
  }
}

/**
 * Creates (or resumes) the shared AudioContext. iOS Safari only allows audio to start
 * playing programmatically later in a session if it's unlocked from inside a real user
 * gesture handler, so this must be called synchronously from one (e.g. a Start button's
 * onClick) - never from a timer callback or on page load.
 */
export function unlockAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    audioContext = new AudioContextClass()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  // Resuming isn't enough on iOS: it wants a sound actually started from inside the
  // gesture before it will let later timer-driven ones through. One silent sample
  // counts, and costs nothing anywhere else.
  try {
    const source = audioContext.createBufferSource()
    source.buffer = audioContext.createBuffer(1, 1, 22050)
    source.connect(audioContext.destination)
    source.start(0)
  } catch {
    // A context too broken to play silence won't play tones either - nothing to do.
  }
}

// Backgrounding the app or the screen locking mid-workout suspends the context, and
// nothing resumes it on the way back, so every cue after that is lost.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audioContext?.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
  })
}

/** What the audio layer can actually do right now - see the Sound check in the Log tab. */
export function audioStatus() {
  return {
    supported: Boolean(window.AudioContext || window.webkitAudioContext),
    state: audioContext ? audioContext.state : 'not started',
    muted,
    canVibrate: Boolean(navigator.vibrate),
  }
}

// Each tone is a short sequence of oscillator segments (frequency/waveform/duration,
// optionally offset by `delay` seconds) so multi-note cues can be expressed the same
// way as single-beep ones.
const TONE_DEFS = {
  transition: [{ freq: 659.25, duration: 0.15, type: 'sine' }],
  tick: [{ freq: 1046.5, duration: 0.07, type: 'square' }],
  roundComplete: [
    { freq: 523.25, duration: 0.12, type: 'sine' },
    { freq: 783.99, duration: 0.16, type: 'sine', delay: 0.13 },
  ],
  sessionComplete: [
    { freq: 523.25, duration: 0.13, type: 'sine' },
    { freq: 659.25, duration: 0.13, type: 'sine', delay: 0.14 },
    { freq: 783.99, duration: 0.13, type: 'sine', delay: 0.28 },
    { freq: 1046.5, duration: 0.32, type: 'sine', delay: 0.42 },
  ],
}

const VIBRATION_PATTERNS = {
  transition: [100],
  tick: [30],
  roundComplete: [100, 50, 100],
  sessionComplete: [100, 50, 100, 50, 100],
}

function playSegment(ctx, { freq, duration, type, delay = 0 }) {
  const startTime = ctx.currentTime + delay
  const endTime = startTime + duration
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  // Quick fade in/out avoids the clicking pop a hard on/off edge would make.
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.25, startTime + 0.01)
  gain.gain.setValueAtTime(0.25, Math.max(startTime + 0.01, endTime - 0.02))
  gain.gain.linearRampToValueAtTime(0, endTime)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(endTime + 0.02)
}

/**
 * Plays the named cue: its oscillator tone (if audio has been unlocked and isn't
 * muted) and a matching vibration pattern (if the platform supports it and isn't
 * muted - a silent no-op on iOS, real on Android Chrome).
 */
export function playTone(kind) {
  if (muted) return
  const segments = TONE_DEFS[kind]
  if (audioContext && segments) {
    if (audioContext.state === 'running') {
      segments.forEach((segment) => playSegment(audioContext, segment))
    } else {
      // resume() is a promise. Scheduling against a context that hasn't actually
      // resumed yet drops the tone, so wait for it rather than firing and hoping.
      audioContext
        .resume()
        .then(() => segments.forEach((segment) => playSegment(audioContext, segment)))
        .catch(() => {})
    }
  }
  if (navigator.vibrate) {
    navigator.vibrate(VIBRATION_PATTERNS[kind] ?? [100])
  }
}
