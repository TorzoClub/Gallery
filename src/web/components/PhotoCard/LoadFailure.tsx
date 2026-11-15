import s from './LoadFailure.module.scss'

/** 本地内联的刷新图标：两个循环箭头，扁平、跟随 currentColor，不依赖图标包 */
function RetryIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M20 12a8 8 0 0 0-15.2-3.4" />
      <path d="M4 4v5h5" />
      <path d="M4 12a8 8 0 0 0 15.2 3.4" />
      <path d="M20 20v-5h-5" />
    </svg>
  )
}

export default function LoadFailure({ onClick }: { onClick(): void }) {
  return (
    <div className={s.overlay}>
      <div className={s.message} role="status">读取失败</div>
      <button
        type="button"
        className={s.retry}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        }}
      >
        <RetryIcon />
        <span className={s.label}>重试</span>
      </button>
    </div>
  )
}
