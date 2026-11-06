const MAX_TABS = 5
const LOCK_PREFIX = '__app_tab__:'
const GUARD_LOCK = '__app_tab_guard__'

let myLockName: string | null = null

export type TabSlotResult = {
  ok: boolean
  skipped?: boolean
}

/**
 * 用 Web Locks 给每个顶层页面占一个槽位。
 * 锁由浏览器持有到页面销毁；不支持 Web Locks 时不做限制。
 * iframe 不单独计数，只由顶层窗口占位。
 */
export async function acquireTabSlot(): Promise<TabSlotResult> {
  if (window.top !== window.self) {
    return { ok: true, skipped: true }
  }

  if (!navigator.locks) {
    return { ok: true }
  }

  if (myLockName !== null) {
    return { ok: true }
  }

  return navigator.locks.request(GUARD_LOCK, async () => {
    const { held } = await navigator.locks.query()
    const count = (held ?? []).filter(lock => (lock.name ?? '').startsWith(LOCK_PREFIX)).length
    if (count >= MAX_TABS) {
      return { ok: false }
    }

    // 在临界区内把真正占位的锁拿到手，再释放 guard，避免两个标签同时看到空位。
    const name = LOCK_PREFIX + crypto.randomUUID()
    let resolve_acquisition!: () => void
    const acquired = new Promise<void>((resolve) => {
      resolve_acquisition = resolve
    })

    void navigator.locks.request(name, () => {
      resolve_acquisition()
      return new Promise<void>(() => {})
    }).catch(() => {
      // 极少见的 LockManager 失败：不要让页面永远停在等待槽位。
      resolve_acquisition()
    })

    await acquired
    myLockName = name
    return { ok: true }
  })
}

export { MAX_TABS }
