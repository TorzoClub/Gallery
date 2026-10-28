let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (audioContext !== null) {
    return audioContext
  }

  const AudioContextConstructor = window.AudioContext
  if (AudioContextConstructor === undefined) {
    return null
  }

  try {
    audioContext = new AudioContextConstructor()
  } catch {
    return null
  }

  return audioContext
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  const duration = 0.95
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  )
  const data = buffer.getChannelData(0)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }

  return buffer
}

export function primeChannelAudio(): void {
  const context = getAudioContext()
  if (context === null) {
    return
  }

  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined)
  }
}

export function playChannelSwitchSound(): void {
  const context = getAudioContext()
  if (context === null) {
    return
  }

  const start = () => {
    try {
      if (context.state === 'closed') {
        return
      }

      const now = context.currentTime
      const master = context.createGain()
      master.gain.value = 1.28
      master.connect(context.destination)

      // CRT 换台时那一下低沉的 "po"。
      const thump = context.createOscillator()
      const thumpGain = context.createGain()
      thump.type = 'triangle'
      thump.frequency.setValueAtTime(118, now)
      thump.frequency.exponentialRampToValueAtTime(42, now + 0.2)
      thumpGain.gain.setValueAtTime(0.0001, now)
      thumpGain.gain.linearRampToValueAtTime(0.62, now + 0.012)
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
      thump.connect(thumpGain)
      thumpGain.connect(master)
      thump.start(now)
      thump.stop(now + 0.26)

      // 短暂的高频 "click"，让换台更像机械切换。
      const click = context.createOscillator()
      const clickGain = context.createGain()
      click.type = 'square'
      click.frequency.setValueAtTime(2100, now)
      click.frequency.exponentialRampToValueAtTime(740, now + 0.035)
      clickGain.gain.setValueAtTime(0.0001, now)
      clickGain.gain.linearRampToValueAtTime(0.035, now + 0.004)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
      click.connect(clickGain)
      clickGain.connect(master)
      click.start(now)
      click.stop(now + 0.05)

      // "shasha"：带通白噪声，末尾突然切断。
      const noise = context.createBufferSource()
      const noiseFilter = context.createBiquadFilter()
      const noiseGain = context.createGain()
      noise.buffer = getNoiseBuffer(context)
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.setValueAtTime(1650, now)
      noiseFilter.Q.value = 0.7
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.linearRampToValueAtTime(0.11, now + 0.025)
      noiseGain.gain.setValueAtTime(0.11, now + 0.78)
      noiseGain.gain.setValueAtTime(0, now + 0.86)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(master)
      noise.start(now)
      noise.stop(now + 0.88)
    } catch {
      // AudioContext 在部分浏览器/自动播放策略下不可用，静默降级。
    }
  }

  if (context.state === 'suspended') {
    void context.resume().then(start).catch(() => undefined)
    return
  }

  start()
}
