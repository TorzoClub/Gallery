/**
 * 门禁机（后台登录 AccessPanel）的声音：按键“哔”、开锁成功、拒绝。
 * 全部用振荡器实时合成，像小喇叭孔里出来的蜂鸣器声；AudioContext 不可用时静默降级。
 */

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

/** 一个蜂鸣器音：方波过低通（去掉刺耳的高次谐波），2ms 起音，到 duration 结束时衰减完 */
function beep(
  context: AudioContext,
  destination: AudioNode,
  { at, frequency, duration, volume, cutoff }: {
    at: number
    frequency: number
    duration: number
    volume: number
    cutoff: number
  },
): void {
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  oscillator.type = 'square'
  oscillator.frequency.setValueAtTime(frequency, at)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(cutoff, at)
  filter.Q.value = 0.7
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.002)
  gain.gain.setValueAtTime(volume, at + duration * 0.7)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.01)
}

function play(render: (context: AudioContext, now: number) => void): void {
  const context = getAudioContext()
  if (context === null) {
    return
  }
  const run = () => {
    try {
      if (context.state !== 'running') {
        return
      }
      render(context, context.currentTime)
    } catch {
      // 声音只是附加反馈，失败不影响登录
    }
  }
  if (context.state === 'suspended') {
    void context.resume().then(run).catch(() => undefined)
    return
  }
  run()
}

/** 按键：一声 1760Hz、45ms 的短“哔”，每个键都一样高，像真的门禁键盘 */
export function playAccessKeySound(): void {
  play((context, now) => {
    beep(context, context.destination, {
      at: now,
      frequency: 1760,
      duration: 0.045,
      volume: 0.07,
      cutoff: 3600,
    })
  })
}

/** 开锁成功的时长：两声上行的“哔—哔”（C6 → G6，各 110ms，中间空 40ms） */
export const ACCESS_GRANTED_SOUND_MS = 260

export function playAccessGrantedSound(): void {
  play((context, now) => {
    beep(context, context.destination, { at: now, frequency: 1046.5, duration: 0.11, volume: 0.09, cutoff: 3200 })
    beep(context, context.destination, { at: now + 0.15, frequency: 1568, duration: 0.11, volume: 0.09, cutoff: 3200 })
  })
}

/** 拒绝：两声低沉的蜂鸣“嗡、嗡”（196Hz，各 150ms，中间空 60ms），约 360ms */
export function playAccessDeniedSound(): void {
  play((context, now) => {
    beep(context, context.destination, { at: now, frequency: 196, duration: 0.15, volume: 0.12, cutoff: 1400 })
    beep(context, context.destination, { at: now + 0.21, frequency: 196, duration: 0.15, volume: 0.12, cutoff: 1400 })
  })
}

/**
 * 报警：本地 token 无效 / 过期时响。高低两音交替的警报“嘀嘟嘀嘟”，
 * 988Hz（B5）/ 740Hz（F#5）方波各 110ms、紧挨着交替 4 次，约 440ms。
 * 比拒绝的低沉蜂鸣更尖、更急：密码错是“你按错了”，token 失效是“这张卡有问题”。
 */
export function playAccessAlarmSound(): void {
  play((context, now) => {
    for (let index = 0; index < 4; index += 1) {
      beep(context, context.destination, {
        at: now + index * 0.11,
        frequency: index % 2 === 0 ? 988 : 740,
        duration: 0.1,
        volume: 0.1,
        cutoff: 3000,
      })
    }
  })
}
