/**
 * 磁粒落到相纸上的“ta～”一声：起音是极短的“t”，尾音是快速下沉的“a”。
 * 全部用振荡器 + 一小段噪声实时合成；AudioContext 不可用时静默降级。
 */

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

/** 一小段白噪声，只用来做起音的“t” */
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer !== null) {
    return noiseBuffer
  }
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.1), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

export function primeMagnetAudio(): void {
  const context = getAudioContext()
  if (context !== null && context.state === 'suspended') {
    void context.resume().catch(() => undefined)
  }
}

/**
 * 磁粒落地：一声干脆的“ta”——
 * 6ms 的高通噪声是“t”的摩擦起音，紧跟着 460→150Hz 的正弦在 80ms 内衰减是“a”。
 * 整体约 90ms，比翻页短得多，像小磁粒磕在纸质桌面上。
 */
export function playMagnetDropSound(): void {
  const context = getAudioContext()
  if (context === null) {
    return
  }
  const play = () => {
    try {
      if (context.state === 'closed') {
        return
      }
      const now = context.currentTime

      const noise = context.createBufferSource()
      const biquad = context.createBiquadFilter()
      const clickGain = context.createGain()
      noise.buffer = getNoiseBuffer(context)
      biquad.type = 'highpass'
      biquad.frequency.setValueAtTime(2600, now)
      biquad.Q.value = 0.7
      clickGain.gain.setValueAtTime(0.16, now)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
      noise.connect(biquad)
      biquad.connect(clickGain)
      clickGain.connect(context.destination)
      noise.start(now, Math.random() * 0.05)
      noise.stop(now + 0.04)

      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(460, now)
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.26, now + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(now)
      osc.stop(now + 0.1)
    } catch {
      // 自动播放策略下 AudioContext 不可用时静默降级
    }
  }
  if (context.state === 'suspended') {
    void context.resume().then(play).catch(() => undefined)
    return
  }
  play()
}
