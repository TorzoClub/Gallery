import React, { useEffect, useState, useRef } from 'react';

interface ZeldaQuestBannerProps {
  isOpen: boolean;
  category?: string;
  title?: string;
}

export const ZeldaQuestBanner: React.FC<ZeldaQuestBannerProps> = ({
  isOpen,
  category = "迷你挑战",
  title = "同装摄影活动",
}) => {
  const [showComplete, setShowComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 初始化浏览器音频上下文
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // 1. 播放主体展开音效:  "呼 (Whoosh / Swoosh)"的声音
  const playStartSound = () => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Create 1.2 seconds of white noise
      const bufferSize = ctx.sampleRate * 1.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      // Filter: Low-pass sweep from 150Hz -> 900Hz -> 200Hz to simulate wind/air movement
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(3.0, now);
      filter.frequency.setValueAtTime(120, now);
      filter.frequency.exponentialRampToValueAtTime(950, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.9);

      // Sub-bass oscillator boost for impact depth
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(75, now);
      subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.6);
      subGain.gain.setValueAtTime(0.01, now);
      subGain.gain.linearRampToValueAtTime(0.25, now + 0.2);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      // Main Noise Gain envelope (fade in, sustain, smooth fade out)
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.22, now + 0.25);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

      // Connect noise pipeline
      noiseNode.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Connect sub-bass pipeline
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      noiseNode.start(now);
      subOsc.start(now);
      noiseNode.stop(now + 1.1);
      subOsc.stop(now + 0.8);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  };

  // 2. 播放 Complete 盖章音效：真实 Glockenspiel / Celesta (钟琴/钢片琴) 敲击声音
  const playCompleteSound = () => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // 钟琴/钢片琴音符组合 (A5, E6, A6, C#7, E7 - 明亮的 A Major 9 向上琶音感)
      const notes = [
        { freq: 880.00,  delay: 0,    gain: 0.18 }, // A5
        { freq: 1318.51, delay: 0.02, gain: 0.22 }, // E6
        { freq: 1760.00, delay: 0.04, gain: 0.25 }, // A6
        { freq: 2217.46, delay: 0.06, gain: 0.20 }, // C#7
        { freq: 2637.02, delay: 0.08, gain: 0.15 }, // E7
      ];

      notes.forEach(({ freq, delay, gain: maxGain }) => {
        const noteTime = now + delay;

        // --- A. 击槌敲击瞬态 (Mallet Attack Transient) ---
        // 模拟硬质槌头击打金属板瞬间的“叮/嗒”声
        const attackOsc = ctx.createOscillator();
        const attackGain = ctx.createGain();
        attackOsc.type = 'triangle';
        attackOsc.frequency.setValueAtTime(freq * 4, noteTime);
        attackOsc.frequency.exponentialRampToValueAtTime(freq, noteTime + 0.015);

        attackGain.gain.setValueAtTime(maxGain * 0.8, noteTime);
        attackGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.015);

        attackOsc.connect(attackGain);
        attackGain.connect(ctx.destination);
        attackOsc.start(noteTime);
        attackOsc.stop(noteTime + 0.02);

        // --- B. 琴键主音与物理非谐波泛音 (Celesta / Glockenspiel Body Resonance) ---
        // 钟琴的泛音非整数倍，通常包含 2.76x 和 5.40x 的金属特有泛音
        const partials = [
          { ratio: 1.0,   amp: 1.0,   decay: 1.8 }, // 基音
          { ratio: 2.756, amp: 0.4,   decay: 0.8 }, // 钟琴特征金属泛音 1
          { ratio: 5.404, amp: 0.15,  decay: 0.4 }, // 钟琴特征金属泛音 2
        ];

        partials.forEach(partial => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();

          // 正弦波+轻微微调，模拟金属余音
          osc.type = 'sine';
          const pFreq = freq * partial.ratio;
          osc.frequency.setValueAtTime(pFreq, noteTime);

          // 微弱的 pitch 下降 (0.1%)，模拟金属振动刚度
          osc.frequency.exponentialRampToValueAtTime(pFreq * 0.999, noteTime + partial.decay);

          // 包络：极速 Attack + 指数级衰减
          const currentGain = maxGain * partial.amp;
          noteGain.gain.setValueAtTime(0.0001, noteTime);
          noteGain.gain.linearRampToValueAtTime(currentGain, noteTime + 0.004);
          noteGain.gain.exponentialRampToValueAtTime(0.00001, noteTime + partial.decay);

          // LFO 颤音 (Vibrato) 增加空气回响感
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.value = 6; // 6Hz 颤音
          lfoGain.gain.value = pFreq * 0.002;
          lfo.connect(osc.frequency);
          lfo.start(noteTime);
          lfo.stop(noteTime + partial.decay);

          osc.connect(noteGain);
          noteGain.connect(ctx.destination);

          osc.start(noteTime);
          osc.stop(noteTime + partial.decay);
        });
      });

    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setShowComplete(false);

      // 1. 触发主体入场及音效
      playStartSound();

      // 2. 延迟 600ms 后弹出 Complete 印章并触发晶莹的“叮～”声
      const timer = setTimeout(() => {
        setShowComplete(true);
        playCompleteSound();
      }, 600);

      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(2px)',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* 中间横向全宽光带背景 */}
      <div
        style={{
          width: '100vw',
          padding: '24px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.95)',
          opacity: isOpen ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', position: 'relative' }}>

          {/* 顶部：Icon 与 挑战类型 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <svg style={{ width: '20px', height: '20px', color: '#fde047' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 19h20L12 2zm0 4.5l6.5 11.5h-13L12 6.5z" />
            </svg>
            <span style={{ color: '#e5e7eb', fontSize: '15px', fontWeight: 500, letterSpacing: '0.15em' }}>
              {category}
            </span>
          </div>

          {/* 横向渐变分割线 */}
          <div style={{ position: 'relative', height: '2px', width: '100%', marginBottom: '12px', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(254,240,138,0.7) 60%, transparent 100%)',
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                opacity: isOpen ? 1 : 0,
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {/* 主标题与 COMPLETE 印章 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline' }}>
            <h1
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: '#111827',
                WebkitTextStroke: '1px rgba(255, 255, 255, 0.7)',
                textShadow: '0 2px 12px rgba(255, 255, 255, 0.4)',
                margin: 0,
              }}
            >
              {title}
            </h1>

            {/* Complete 印章：盖章降落、弹性回弹与旋转 */}
            <div
              style={{
                position: 'absolute',
                left: 'calc(50% + 40px)',
                bottom: '4px',
                transform: showComplete
                  ? 'translateY(0) scale(1) rotate(-3deg)'
                  : 'translateY(-16px) scale(1.4) rotate(8deg)',
                opacity: showComplete ? 1 : 0,
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                  fontStyle: 'italic',
                  fontWeight: 'bold',
                  fontSize: 'clamp(2rem, 4vw, 3.8rem)',
                  letterSpacing: '0.05em',
                  color: '#fef08a',
                  textShadow: '0 0 16px rgba(254, 240, 138, 0.7), 2px 2px 6px rgba(0, 0, 0, 0.9)',
                  userSelect: 'none',
                  display: 'inline-block',
                }}
              >
                Complete
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
