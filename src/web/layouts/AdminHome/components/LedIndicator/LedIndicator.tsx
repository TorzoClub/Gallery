import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../../../utils/cn';
import styles from './LedIndicator.module.css';

export type LedColor = 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'amber';

export interface LedIndicatorProps {
  /**
   * LED 颜色，为 null/undefined 时表示无发光状态
   */
  color?: LedColor | null;

  /**
   * 显示模式：
   * - 'solid': 常亮模式 (默认)
   * - 'flicker': TX/RX 频闪模式 (默认熄灭，pulseTrigger 更新时瞬间亮起，停留 pulseKeeptime 后衰减)
   */
  mode?: 'solid' | 'flicker';

  /**
   * 触发脉冲的信号（如下载完成计数器、文件 idx）。
   * 每次更新且在 flicker 模式下，触发一次“瞬间亮起 -> 保持 -> 衰减熄灭”
   */
  pulseTrigger?: number | string;

  /**
   * 亮灯后的高亮保持/停留时长 (毫秒 ms)，默认 0ms。
   * 超过 pulseKeeptime 后，才会开始进入 decayDuration 衰减过程。
   */
  pulseKeeptime?: number;

  /**
   * 亮灯后的衰减时长 (毫秒 ms)，默认 150ms
   */
  decayDuration?: number;

  /**
   * 衰减系数 (0 ~ 1)，默认 0.25：
   * - 1: 不渐变衰减，保持最亮状态，到达 decayDuration 时瞬间熄灭
   * - < 1: 按物理放电曲线平滑衰减至熄灭 (系数越小，前期衰减越快)
   */
  decayFactor?: number;

  /** 贴纸 / 标签 */
  label?: ReactNode;

  className?: string;
}

const colorMap: Record<LedColor, string> = {
  green: styles.green,
  red: styles.red,
  blue: styles.blue,
  yellow: styles.yellow,
  purple: styles.purple,
  amber: styles.amber,
};

export function LedIndicator({
  color = null,
  mode = 'solid',
  pulseTrigger,
  pulseKeeptime = 0,
  decayDuration = 150,
  decayFactor = 0.25,
  label,
  className,
}: LedIndicatorProps) {
  const [litOpacity, setLitOpacity] = useState<number>(mode === 'solid' && color ? 1 : 0);
  const [isDecaying, setIsDecaying] = useState(false);

  // 1. 处理 solid 常亮模式
  useEffect(() => {
    if (mode === 'solid') {
      setIsDecaying(false);
      setLitOpacity(color ? 1 : 0);
    }
  }, [mode, color]);

  // 2. 处理 flicker 脉冲模式：pulseTrigger 更新时触发“瞬间亮起 -> 保持 pulseKeeptime -> 衰减”
  useEffect(() => {
    if (mode !== 'flicker' || pulseTrigger === undefined || pulseTrigger === null || !color) {
      if (mode === 'flicker') {
        setLitOpacity(0);
      }
      return;
    }

    // A: 瞬间强点亮 (零延迟，关闭 transition)
    setIsDecaying(false);
    setLitOpacity(1);

    // B: 在 pulseKeeptime 保持时间到达后，启动衰减过程
    const keepTimer = setTimeout(() => {
      setIsDecaying(true);
      setLitOpacity(0);
    }, pulseKeeptime);

    return () => clearTimeout(keepTimer);
  }, [pulseTrigger, mode, color, pulseKeeptime]);

  // 根据 decayFactor 与状态计算 transition 缓动
  const getTransitionStyle = () => {
    if (mode === 'solid') {
      return 'opacity 0.15s ease';
    }
    if (!isDecaying) {
      return 'none'; // 高亮保持阶段：关闭 transition，避免延迟
    }

    // 系数为 1 时：保持高亮直至时长结束瞬间熄灭 (step-end)
    if (decayFactor >= 1) {
      return `opacity ${decayDuration}ms step-end`;
    }

    // 系数 < 1 时：计算 RC 电容放电缓动曲线
    const factor = Math.max(0, decayFactor);
    const easing = `cubic-bezier(${0.1 * (1 - factor)}, ${0.7 * factor}, ${0.2 + 0.8 * factor}, 1)`;
    return `opacity ${decayDuration}ms ${easing}`;
  };

  return (
    <div className={cn(styles.wrapper, className)}>
      <div className={styles.socket}>
        {/* 底层 (z-index: 1)：永远存在的单灰半透明熄灭灯芯 */}
        <div className={cn(styles.led, styles.off)} />

        {/* 顶层 (z-index: 2)：彩色发光层，通过 opacity 衰减与底层 off 混合 */}
        {color && (
          <div
            className={cn(styles.led, colorMap[color], styles.lit)}
            style={{
              opacity: litOpacity,
              transition: getTransitionStyle(),
            }}
          />
        )}
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
