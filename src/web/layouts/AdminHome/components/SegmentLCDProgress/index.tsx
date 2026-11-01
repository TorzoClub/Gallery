import React, { useState, useLayoutEffect, useRef } from 'react';

export interface SegmentLCDProgressProps {
  progress?: number;
  height?: number | string;
  frameThickness?: number;
  showFrame?: boolean;
  screenPadding?: number;
  segmentWidth?: number;
  segmentHeight?: number | string;
  segmentGap?: number;
  className?: string;
  style?: React.CSSProperties;
}

const SegmentLCDProgress = ({
  progress = 0,             // 进度：0 ~ 100
  height = 40,              // 组件总高度 (包含金属边框)
  frameThickness = 8,       // 金属边框厚度 (px)
  showFrame = false,        // 显示金属边框
  screenPadding = 5,        // 屏幕边缘留白 (px)
  segmentWidth = 8,         // 单个液晶格子的宽度 (px)
  segmentHeight = '100%',   // 单个液晶格子的高度
  segmentGap = 2,           // 格子之间的物理间隙 (px)
  className = '',
  style = {}
}: SegmentLCDProgressProps) => {
  const screenRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [fillWidth, setFillWidth] = useState(0);

  useLayoutEffect(() => {
    if (!screenRef.current) return;

    const measureAndSet = () => {
      const el = screenRef.current;
      if (!el) return;

      // 1. 计算屏内纯水平可用空间
      const availableWidth = Math.max(0, el.clientWidth - screenPadding * 2);
      const step = segmentWidth + segmentGap;

      if (step <= 0) return;

      // 2. 精确计算容纳的最大格子数 N
      // 公式：N * segmentWidth + (N - 1) * segmentGap <= availableWidth
      const totalBlocks = Math.max(0, Math.floor((availableWidth + segmentGap) / step));

      // 3. 计算真实物理占用宽度（去除了末尾多余的 segmentGap）
      const newTrackWidth = totalBlocks > 0
        ? totalBlocks * segmentWidth + (totalBlocks - 1) * segmentGap
        : 0;

      // 4. 计算需要点亮的格子数
      let activeBlocks = Math.round((progress / 100) * totalBlocks);

      // 5. 未达 100% 时的保护
      if (progress < 100 && activeBlocks === totalBlocks) {
        activeBlocks = Math.max(0, totalBlocks - 1);
      }

      // 6. 精确计算填充层真实物理宽度
      const newFillWidth = activeBlocks > 0
        ? activeBlocks * segmentWidth + (activeBlocks - 1) * segmentGap
        : 0;

      setTrackWidth(newTrackWidth);
      setFillWidth(newFillWidth);
    };

    measureAndSet();

    const observer = new ResizeObserver(() => measureAndSet());
    observer.observe(screenRef.current);

    return () => observer.disconnect();
  }, [progress, screenPadding, segmentWidth, segmentGap]);

  // --- 动态样式 ---

  const metalFrameStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    width: '100%',
    boxSizing: 'border-box',
    background: 'linear-gradient(to bottom, #e2e2e2 0%, #b8b8b8 100%)',
    padding: `${frameThickness}px`,
    ...(showFrame ? {
      border: '1px solid #999',
      borderBottomColor: '#666',
      borderRadius: '6px',
      boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.9),
        inset 1px 0 0 rgba(255,255,255,0.5),
        inset -1px 0 0 rgba(255,255,255,0.5),
        rgba(0, 0, 0, 0.15) 0px 8px 4px -4px
      `,
    } : {}),
    ...style
  };

  const screenStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#9eb492',
    boxShadow: 'rgba(0, 0, 0, 0.5) 0px 3px 6px inset, rgb(149 149 149) 0px 0px 0px 1px inset, 0 1px 0px white, 0 -1px 0px grey',
    padding: `${screenPadding}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', // trackWidth 精确裁剪后，Flex 居中可确保左右 Padding 绝对相等
    borderRadius: '1px',
    overflow: 'hidden'
  };

  const step = segmentWidth + segmentGap;

  const trackStyle: React.CSSProperties = {
    height: typeof segmentHeight === 'number' ? `${segmentHeight}px` : segmentHeight,
    width: `${trackWidth}px`,
    backgroundImage: `repeating-linear-gradient(to right, rgba(0,0,0,0.08) 0, rgba(0,0,0,0.08) ${segmentWidth}px, transparent ${segmentWidth}px, transparent ${step}px)`
  };

  const fillStyle: React.CSSProperties = {
    height: '100%',
    width: `${fillWidth}px`,
    backgroundImage: `repeating-linear-gradient(to right, #182015 0, #182015 ${segmentWidth}px, transparent ${segmentWidth}px, transparent ${step}px)`
  };

  return (
    <div className={className} style={metalFrameStyle}>
      <div ref={screenRef} style={screenStyle}>
        <div style={trackStyle}>
          <div style={fillStyle} />
        </div>
      </div>
    </div>
  );
};

export default SegmentLCDProgress;
