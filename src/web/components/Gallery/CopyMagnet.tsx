import { createPortal } from 'react-dom'
import { Magnet } from 'components/Magnet'

/** 复印期间盖在掉落卡片上面的磁粒；坐标是磁粒未变换时的布局中心 */
export function CopyMagnet({ x, y }: { x: number; y: number }) {
  return createPortal(
    <span
      className='photo-card-copy-magnet'
      aria-hidden
      style={{ left: `${x - 20}px`, top: `${y - 20}px` }}
    >
      <Magnet />
    </span>,
    document.body,
  )
}
