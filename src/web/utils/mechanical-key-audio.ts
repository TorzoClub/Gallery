let audioContext: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

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
  if (noiseBuffer !== null) {
    return noiseBuffer
  }

  const duration = 0.06
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  )
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }

  noiseBuffer = buffer
  return buffer
}

/**
 * 录音机式琴键按下时的一声短促机械响动：低频键体 + 金属 click + 噪声。
 * 失败时静默降级，不影响交互。
 */
export function playMechanicalKeySound(): void {
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
      master.gain.value = 1
      master.connect(context.destination)

      const thump = context.createOscillator()
      const thumpGain = context.createGain()
      thump.type = 'triangle'
      thump.frequency.setValueAtTime(155, now)
      thump.frequency.exponentialRampToValueAtTime(78, now + 0.075)
      thumpGain.gain.setValueAtTime(0.0001, now)
      thumpGain.gain.linearRampToValueAtTime(0.42, now + 0.004)
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
      thump.connect(thumpGain)
      thumpGain.connect(master)
      thump.start(now)
      thump.stop(now + 0.11)

      const click = context.createOscillator()
      const clickGain = context.createGain()
      click.type = 'square'
      click.frequency.setValueAtTime(2300, now)
      click.frequency.exponentialRampToValueAtTime(980, now + 0.025)
      clickGain.gain.setValueAtTime(0.0001, now)
      clickGain.gain.linearRampToValueAtTime(0.06, now + 0.002)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032)
      click.connect(clickGain)
      clickGain.connect(master)
      click.start(now)
      click.stop(now + 0.04)

      const noise = context.createBufferSource()
      const noiseFilter = context.createBiquadFilter()
      const noiseGain = context.createGain()
      noise.buffer = getNoiseBuffer(context)
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.setValueAtTime(1250, now)
      noiseFilter.Q.value = 1.1
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.linearRampToValueAtTime(0.2, now + 0.003)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(master)
      noise.start(now)
      noise.stop(now + 0.055)
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

/**
 * 另一个键被顶起来时的短促回弹声：比按下更轻、更高。
 * 用 45ms 的延迟让它在按下声音之后出现。
 */
export function playMechanicalKeyReleaseSound(): void {
  const context = getAudioContext()
  if (context === null) {
    return
  }

  const start = () => {
    try {
      if (context.state === 'closed') {
        return
      }

      const now = context.currentTime + 0.045
      const master = context.createGain()
      master.gain.value = 0.88
      master.connect(context.destination)

      const pop = context.createOscillator()
      const popGain = context.createGain()
      pop.type = 'triangle'
      pop.frequency.setValueAtTime(310, now)
      pop.frequency.exponentialRampToValueAtTime(520, now + 0.045)
      popGain.gain.setValueAtTime(0.0001, now)
      popGain.gain.linearRampToValueAtTime(0.15, now + 0.003)
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
      pop.connect(popGain)
      popGain.connect(master)
      pop.start(now)
      pop.stop(now + 0.08)

      const click = context.createOscillator()
      const clickGain = context.createGain()
      click.type = 'square'
      click.frequency.setValueAtTime(1650, now)
      click.frequency.exponentialRampToValueAtTime(2700, now + 0.018)
      clickGain.gain.setValueAtTime(0.0001, now)
      clickGain.gain.linearRampToValueAtTime(0.04, now + 0.0015)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026)
      click.connect(clickGain)
      clickGain.connect(master)
      click.start(now)
      click.stop(now + 0.03)

      const noise = context.createBufferSource()
      const noiseFilter = context.createBiquadFilter()
      const noiseGain = context.createGain()
      noise.buffer = getNoiseBuffer(context)
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.setValueAtTime(1800, now)
      noiseFilter.Q.value = 0.8
      noiseGain.gain.setValueAtTime(0.0001, now)
      noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.002)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(master)
      noise.start(now)
      noise.stop(now + 0.045)
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
