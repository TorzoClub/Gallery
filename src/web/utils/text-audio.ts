let textAudioContext: AudioContext | null = null

function getTextAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (textAudioContext !== null) {
    return textAudioContext
  }

  if (typeof window.AudioContext !== 'function') {
    return null
  }

  try {
    textAudioContext = new window.AudioContext()
  } catch {
    return null
  }

  return textAudioContext
}

export function primeTextAudio(): void {
  const context = getTextAudioContext()
  if (context === null) {
    return
  }
  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined)
  }
}

/**
 * A single short, slightly randomized game-dialogue blip.
 * The pitch variation keeps long typewriter paragraphs from sounding robotic.
 */
export function playTextBlip(character: string): void {
  const context = getTextAudioContext()
  if (context === null) {
    return
  }

  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined)
    return
  }
  if (context.state !== 'running') {
    return
  }

  try {
    const now = context.currentTime
    const code = character.length > 0 ? character.charCodeAt(0) : 0
    const pitch = 540 + (code % 360) + Math.floor(Math.random() * 46)

    const oscillator = context.createOscillator()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()

    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(pitch, now)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, now)
    filter.Q.value = 0.7

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.09, now + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.034)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.04)
  } catch {
    // Audio is best-effort; text playback must never fail because of it.
  }
}
