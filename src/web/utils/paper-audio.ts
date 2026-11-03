/**
 * 名单簿（线圈本）的纸页音效：翻下一页、翻回上一页、撕下一页。
 * 全部用白噪声 + 滤波器 + 短包络实时合成；AudioContext 不可用时静默降级。
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

/** 1 秒的白噪声，够翻页的“唰”和撕纸用；每次从随机位置开始播，听起来不重复 */
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer !== null) {
    return noiseBuffer
  }
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

function playWith(build: (context: AudioContext, now: number, master: GainNode) => void, masterGain = 1): void {
  const context = getAudioContext()
  if (context === null) {
    return
  }
  const start = () => {
    try {
      if (context.state === 'closed') {
        return
      }
      const master = context.createGain()
      master.gain.value = masterGain
      master.connect(context.destination)
      build(context, context.currentTime, master)
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

type Sweep = {
  at: number
  /** 时长（秒） */
  duration: number
  filter: BiquadFilterType
  from: number
  to: number
  q: number
  peak: number
  /** 峰值出现在时长的哪个位置（0–1） */
  peakAt: number
}

/** 一段经滤波的噪声，滤波频率从 from 滑到 to；包络先升到 peak 再衰减 */
function noiseSweep(context: AudioContext, master: GainNode, { at, duration, filter, from, to, q, peak, peakAt }: Sweep): void {
  const noise = context.createBufferSource()
  const biquad = context.createBiquadFilter()
  const gain = context.createGain()
  noise.buffer = getNoiseBuffer(context)
  biquad.type = filter
  biquad.Q.value = q
  biquad.frequency.setValueAtTime(from, at)
  biquad.frequency.exponentialRampToValueAtTime(to, at + duration)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.linearRampToValueAtTime(peak, at + duration * peakAt)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  noise.connect(biquad)
  biquad.connect(gain)
  gain.connect(master)
  noise.start(at, Math.random() * Math.max(0, 1 - duration - 0.02))
  noise.stop(at + duration + 0.01)
}

function thump(context: AudioContext, master: GainNode, { at, from, to, peak, decay }: { at: number; from: number; to: number; peak: number; decay: number }): void {
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + decay)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
  osc.connect(gain)
  gain.connect(master)
  osc.start(at)
  osc.stop(at + decay + 0.01)
}

/** 在用户手势里提前创建 / 恢复音频上下文。撕纸声要等删除请求完成才响，那时已经不在手势里了 */
export function primePaperAudio(): void {
  const context = getAudioContext()
  if (context !== null && context.state === 'suspended') {
    void context.resume().catch(() => undefined)
  }
}

/**
 * 翻下一页：纸被掀起来，带通噪声从 900Hz 往上扫到 3600Hz 的“唰”，在纸翻到 90°（280ms）前后最响；
 * 末尾一点 2400Hz 高通的纸边轻响。约 300ms。
 */
export function playPageFlipSound(): void {
  playWith((context, now, master) => {
    noiseSweep(context, master, { at: now, duration: 0.28, filter: 'bandpass', from: 900, to: 3600, q: 0.8, peak: 0.22, peakAt: 0.55 })
    noiseSweep(context, master, { at: now + 0.2, duration: 0.1, filter: 'highpass', from: 2400, to: 4200, q: 0.6, peak: 0.07, peakAt: 0.2 })
  }, 0.9)
}

/**
 * 翻回上一页：纸从上面落回来，方向和下一页相反：带通噪声从 3200Hz 往下扫到 800Hz，
 * 结尾（翻页 440ms 落定时）一声 180→90Hz 的轻拍和低通噪声，像纸盖回纸堆上。约 460ms。
 */
export function playPageBackSound(): void {
  playWith((context, now, master) => {
    noiseSweep(context, master, { at: now, duration: 0.36, filter: 'bandpass', from: 3200, to: 800, q: 0.8, peak: 0.18, peakAt: 0.4 })
    noiseSweep(context, master, { at: now + 0.39, duration: 0.07, filter: 'lowpass', from: 1400, to: 600, q: 0.7, peak: 0.16, peakAt: 0.12 })
    thump(context, master, { at: now + 0.39, from: 180, to: 90, peak: 0.12, decay: 0.07 })
  }, 0.9)
}

/**
 * 撕下一页：纸在线圈孔之间一格格断开。前 300ms 是一串越来越密的高通噪声颗粒（“咔嚓咔嚓”），
 * 接着一声 1200→4500Hz 的长“嘶啦”把纸整张扯下来。约 520ms。
 */
export function playPageTearSound(): void {
  playWith((context, now, master) => {
    let t = now
    let gap = 0.05
    for (let index = 0; index < 9; index += 1) {
      const frequency = 1800 + Math.random() * 1600
      noiseSweep(context, master, { at: t, duration: 0.028, filter: 'highpass', from: frequency, to: frequency * 1.3, q: 0.9, peak: 0.12 + index * 0.012, peakAt: 0.1 })
      t += gap * (0.75 + Math.random() * 0.5)
      gap *= 0.86
    }
    noiseSweep(context, master, { at: t, duration: 0.22, filter: 'bandpass', from: 1200, to: 4500, q: 0.7, peak: 0.3, peakAt: 0.3 })
    noiseSweep(context, master, { at: t, duration: 0.18, filter: 'lowpass', from: 900, to: 300, q: 0.5, peak: 0.1, peakAt: 0.15 })
  })
}
