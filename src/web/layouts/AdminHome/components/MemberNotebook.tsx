import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'
import Popover from '../../../components/Popover'
import { removeMember } from '../../../admin/api/member'
import { getApiErrorMessage } from '../../../admin/utils/errors'
import { useQueueload } from '../../../utils/queue-load'
import { playPageBackSound, playPageFlipSound, playPageTearSound, primePaperAudio } from '../../../utils/paper-audio'
import type { Member, MemberCanDelete, MemberSubmission } from './AdminConsole'
import { FlipStack, type FlipDir } from './FlipStack'
import { MemberForm, type MemberFormDraft } from './MemberForm'
import styles from './MemberNotebook.module.scss'

/* ============================== 布局 ==============================
 * 三种布局的断点与 AdminConsole.module.css / MemberNotebook.module.scss 完全一致：
 *   S  ≤ 640px   单面板，名单 1 列，拼贴每排 2 张
 *   M  641–1439  控制台下方整行，名单 2 列，拼贴每排 3 张
 *   L  ≥ 1440px  右侧常驻侧栏，名单 2 列，拼贴每排 3 张
 * 名单每页行数、投稿续页的排数和相片大小都由线圈本的实际尺寸算出（S、M 高度固定；L 随侧栏高度变化）。 */

type Layout = 'S' | 'M' | 'L'

const MQ_M = '(min-width: 641px)'
const MQ_L = '(min-width: 1440px)'

const LIST_COLUMNS: Record<Layout, number> = { S: 1, M: 2, L: 2 }
const PRINTS_PER_ROW: Record<Layout, number> = { S: 2, M: 3, L: 3 }

/** 名单行高；纸上的横线也是这个间距的一半 */
const ROW_PX = 54
/** 名单页里横线以外的固定高度：纸面上沿 10 + 线圈留白 18 + 页眉 46 + 翻页条 40 + 下沿 8。与 .sheet / .pageHead / .pager 的尺寸一致 */
const LIST_CHROME_PX = 122

function readLayout(): Layout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'S'
  }
  if (window.matchMedia(MQ_L).matches) return 'L'
  if (window.matchMedia(MQ_M).matches) return 'M'
  return 'S'
}

function useNotebookLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(readLayout)
  useEffect(() => {
    const mqs = [window.matchMedia(MQ_M), window.matchMedia(MQ_L)]
    const sync = () => setLayout(readLayout())
    sync()
    mqs.forEach(mq => mq.addEventListener('change', sync))
    return () => mqs.forEach(mq => mq.removeEventListener('change', sync))
  }, [])
  return layout
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const read = () => setSize(s => (
      s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }
    ))
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

function pageCount(total: number, per_page: number) {
  return Math.max(1, Math.ceil(total / per_page))
}

function clampPage(page: number, total: number, per_page: number) {
  return Math.min(Math.max(page, 0), pageCount(total, per_page) - 1)
}

function matchMember(member: Member, query: string) {
  const q = query.trim().toLowerCase()
  return q === '' || member.qq.includes(q) || member.nickname.toLowerCase().includes(q)
}

/* ============================== 翻页条 ============================== */

function Pager({ page, pages, label, onFlip }: { page: number; pages: number; label: string; onFlip(dir: 1 | -1): void }) {
  return (
    <nav className={styles.pager} aria-label={label}>
      <button type="button" className={styles.pagerButton} disabled={page <= 0} onClick={() => onFlip(-1)}>
        ‹ 上一页
      </button>
      <span className={styles.pagerNum} aria-live="polite">{page + 1} / {pages}</span>
      <button type="button" className={styles.pagerButton} disabled={page >= pages - 1} onClick={() => onFlip(1)}>
        下一页 ›
      </button>
    </nav>
  )
}

/* ============================== 头像 ============================== */

function MemberAvatar({ member }: { member: Member }) {
  const hue = Number(member.qq.replace(/\D/g, '')) % 360 || 0 // 没有头像时，用 QQ 号算一个稳定的底色
  return member.avatarUrl ? (
    <img className={styles.avatar} src={member.avatarUrl} alt="" loading="lazy" />
  ) : (
    <span className={styles.avatar} style={{ background: `hsl(${hue} 40% 82%)`, color: `hsl(${hue} 35% 28%)` }}>
      {member.nickname.slice(0, 1)}
    </span>
  )
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden>
      <path d="M10.5 2.5L5 8l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 页眉最左边、写在页边线左侧的那个小按钮，与名单的序号同一列居中 */
function MarginButton({ label, onClick, onMouseDown, children }: {
  label: string
  onClick(): void
  onMouseDown?(event: React.MouseEvent): void
  children: React.ReactNode
}) {
  return (
    <span className={styles.marginSlot}>
      <button
        type="button"
        className={cn(styles.headButton, styles.iconButton)}
        aria-label={label}
        title={label}
        onMouseDown={onMouseDown}
        onClick={onClick}
      >
        {children}
      </button>
    </span>
  )
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <circle cx="6.5" cy="6.5" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 10l4.25 4.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ============================== 名单页 ============================== */

type Search = {
  open: boolean
  query: string
  onOpen(): void
  onChange(query: string): void
  onClose(): void
  /** 点“X”：清空并收起，不管输入框里有没有字 */
  onClear(): void
  /** 只有刚点开放大镜时才把焦点放进输入框；翻页后重新挂载不抢焦点 */
  takeFocus(): boolean
}

type ListPageProps = {
  members: Member[]
  total: number
  page: number
  perPage: number
  columns: number
  focusId: string | null
  /** 本次打开名单簿后新建的成员：序号位置换成“new”角标 */
  newIds: ReadonlySet<string>
  search: Search
  onOpen(member: Member): void
  onCreate(): void
  onFlip(dir: 1 | -1): void
}

function ListPage({ members, total, page, perPage, columns, focusId, newIds, search, onOpen, onCreate, onFlip }: ListPageProps) {
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const start = page * perPage
  const shown = members.slice(start, start + perPage)
  const pages = pageCount(members.length, perPage)
  const searching = search.query.trim() !== ''

  // 从成员页翻回来时，焦点回到刚才打开的那一行
  useEffect(() => {
    if (focusId === null) return
    root.current?.querySelector<HTMLElement>(`[data-member-id="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true })
    // 只在这一页挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (search.open && search.takeFocus()) {
      input.current?.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.open])

  return (
    <div ref={root} className={styles.page}>
      <div className={styles.pageHead}>
        <div className={styles.headLead}>
          {search.open ? (
            <MarginButton
              label="清空搜索"
              // 按下时不让输入框失焦，否则空输入会先收起，这次点击就落到了放大镜上
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                input.current?.blur()
                search.onClear()
              }}
            >
              <CloseIcon />
            </MarginButton>
          ) : (
            <MarginButton label="搜索成员" onClick={search.onOpen}>
              <SearchIcon />
            </MarginButton>
          )}
          {search.open ? (
            <input
              ref={input}
              className={styles.searchInput}
              type="search"
              value={search.query}
              placeholder="QQ 号或昵称"
              aria-label="搜索成员（QQ 号或昵称）"
              onChange={(event) => search.onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  search.onChange('')
                  event.currentTarget.blur()
                }
              }}
              onBlur={(event) => {
                if (event.currentTarget.value.trim() === '') search.onClose()
              }}
            />
          ) : (
            <span className={styles.bookTitle}>名单簿</span>
          )}
        </div>
        <div className={styles.headActions}>
          <span className={styles.count}>{searching ? `找到 ${members.length} / ${total} 人` : `共 ${total} 人`}</span>
          <button type="button" className={styles.headButton} onClick={onCreate}>新增成员</button>
        </div>
      </div>
      <div className={styles.listArea}>
        {members.length === 0 && <div className={styles.empty}>{searching ? '没有找到这个成员。' : '还没有成员。'}</div>}
        <ol
          className={styles.memberList}
          start={start + 1}
          style={{ '--cols': columns, '--rows': Math.ceil(perPage / columns) } as React.CSSProperties}
        >
          {shown.map((m, i) => (
            <li key={m.id} className={styles.memberCell}>
              <button
                type="button"
                className={styles.member}
                data-member-id={String(m.id)}
                aria-label={`打开成员 ${m.nickname}`}
                onClick={() => onOpen(m)}
              >
                {newIds.has(String(m.id))
                  ? <span className={cn(styles.no, styles.noNew)} aria-label="新成员">new</span>
                  : <span className={styles.no}>{String(start + i + 1).padStart(2, '0')}</span>}
                <MemberAvatar member={m} />
                <span className={styles.who}>
                  <span className={styles.nick}>{m.nickname}</span>
                  <span className={styles.qq}><small>QQ</small>{m.qq}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <Pager page={page} pages={pages} label="名单翻页" onFlip={onFlip} />
    </div>
  )
}

/* ============================== 拼贴的相片 ==============================
 * 每个相片槽是正方形，下面跟一行 26px 的手写说明（margin 8 + 行高 18）。
 * 一张拼贴卡的高度 = 上内边距 14 + (槽宽 + 26) × (1 + 最大错落)，与 .collage / .printSlot / .printCaption 一致。 */

/** 每个槽位的倾角（度）和纵向错落（相片连说明高度的百分比），像随手贴上去 */
const SLOTS: Record<number, Array<{ rotate: number; drop: number }>> = {
  2: [{ rotate: -3, drop: 0 }, { rotate: 2.5, drop: 12 }],
  3: [{ rotate: -4, drop: 4 }, { rotate: 3, drop: 16 }, { rotate: -1.5, drop: 0 }],
}
const MAX_DROP: Record<number, number> = { 2: 0.12, 3: 0.16 }

const COLLAGE_TOP_PX = 14
const CAPTION_PX = 26
/** 相片槽之间的间距，与 .collage 的 gap 一致 */
const PRINT_GAP_PX = 10
/** 三级页面里拼贴卡之间的最小间距，与 .cardRows 的 gap 一致 */
const CARD_GAP_PX = 12
/** 三级页面正文的左右内边距 14 × 2 + 纸边 2 + 给倾斜留的 12 */
const PRINTS_SIDE_PX = 42
/** 三级页面里拼贴卡以外的固定高度：名单页的 122 + 正文上内边距 14 */
const PRINTS_CHROME_PX = LIST_CHROME_PX + 14
/** 续页上的相片不小于这个尺寸；放不下就少排一排 */
const MIN_SLOT_PX = 96

function cardHeight(slot: number, per_row: number) {
  return COLLAGE_TOP_PX + (slot + CAPTION_PX) * (1 + (MAX_DROP[per_row] ?? 0.16))
}

function slotForCardHeight(height: number, per_row: number) {
  return (height - COLLAGE_TOP_PX) / (1 + (MAX_DROP[per_row] ?? 0.16)) - CAPTION_PX
}

/**
 * 续页铺满整张纸：先按纸宽算出最大的相片，再看纸高能排几排。
 * 余下的高度超过半排就多排一排，相片按高度等比缩小（不小于 MIN_SLOT_PX），剩下的空白均匀分到排与排之间。
 */
function printGrid(width: number, height: number, per_row: number) {
  const area_w = Math.max(0, width - PRINTS_SIDE_PX)
  const area_h = Math.max(0, height - PRINTS_CHROME_PX)
  const by_width = (area_w - PRINT_GAP_PX * (per_row - 1)) / per_row
  let rows = Math.max(1, Math.round((area_h + CARD_GAP_PX) / (cardHeight(by_width, per_row) + CARD_GAP_PX)))
  const slotFor = (n: number) => Math.min(by_width, slotForCardHeight((area_h - CARD_GAP_PX * (n - 1)) / n, per_row))
  while (rows > 1 && slotFor(rows) < MIN_SLOT_PX) rows -= 1
  return { rows, slot: Math.max(MIN_SLOT_PX, Math.floor(slotFor(rows))) }
}

function jitter(id: number) {
  // 同一张相片每次的微小倾角都一样：-1 ~ +1 度
  return ((id * 37) % 21 - 10) / 10
}

function Print({ photo, slot }: { photo: MemberSubmission; slot: { rotate: number; drop: number } }) {
  const [status, url, retry] = useQueueload(photo.thumbUrl)
  // 槽位是正方形；相片按自己的宽高比贴进去，长边顶满
  const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1
  const size = aspect >= 1
    ? { width: '100%', height: `${100 / aspect}%` }
    : { width: `${100 * aspect}%`, height: '100%' }

  return (
    <figure
      className={styles.printSlot}
      style={{ '--rotate': `${slot.rotate + jitter(photo.id)}deg`, '--drop': `${slot.drop}%` } as React.CSSProperties}
    >
      <div className={styles.printBox}>
        <div className={styles.print} style={size}>
          <span className={styles.tape} aria-hidden />
          {status === 'LOADED' && <img src={url} alt={photo.desc || photo.galleryName} />}
          {status === 'FAILURE' && (
            <button type="button" className={styles.printRetry} onClick={() => void retry()}>重试</button>
          )}
        </div>
      </div>
      <figcaption className={styles.printCaption} title={photo.desc || undefined}>来自「{photo.galleryName}」</figcaption>
    </figure>
  )
}

/**
 * 一张拼贴卡：一排 2～3 张。只有它所在的纸页被渲染时，里面的相片才会进 queue-load。
 * 传了 slot 就按它定相片和卡的大小（续页）；没传就用 CSS 的默认尺寸（成员页）。
 */
function CollageCard({ photos, perRow, slot }: { photos: MemberSubmission[]; perRow: number; slot?: number }) {
  const slots = SLOTS[perRow] ?? SLOTS[3]
  const style = slot === undefined
    ? undefined
    : { '--slot': `${slot}px`, height: `${Math.ceil(cardHeight(slot, perRow))}px` } as React.CSSProperties
  return (
    <div className={styles.card} style={style}>
      <div className={styles.collage} style={{ '--slots': perRow } as React.CSSProperties}>
        {photos.map((p, i) => <Print key={p.id} photo={p} slot={slots[i % slots.length]} />)}
      </div>
    </div>
  )
}

/**
 * 投稿怎么分到纸页上：
 *   第 0 张纸是成员页（二级页面），表单下面放一张拼贴卡，共 first 张；
 *   之后每张纸是三级页面，整页都是拼贴卡，每张纸放 rest 张（= 排数 × 每排张数）。
 */
type Paging = { first: number; rest: number; perRow: number; slot: number }

function sheetCount(total: number, paging: Paging) {
  return 1 + Math.ceil(Math.max(0, total - paging.first) / paging.rest)
}

function sheetStart(sheet: number, paging: Paging) {
  return sheet === 0 ? 0 : paging.first + (sheet - 1) * paging.rest
}

function sheetEnd(sheet: number, paging: Paging) {
  return sheet === 0 ? paging.first : paging.first + sheet * paging.rest
}

function sheetOfPhoto(index: number, paging: Paging) {
  return index < paging.first ? 0 : 1 + Math.floor((index - paging.first) / paging.rest)
}

function clampSheet(sheet: number, total: number, paging: Paging) {
  return Math.min(Math.max(sheet, 0), sheetCount(total, paging) - 1)
}

function useFocusOnMount() {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

/* ============================== 删除成员 ==============================
 * 页眉里“保存修改”左边的红色按钮。点开是一个确认弹层：
 *   投过稿 → “这位成员曾经有过投稿，不能删”；
 *   没投过稿但投过票 → 服务端同样不让删，提示“这位成员投过票，不能删”；
 *   都没有 → 确认后发删除请求，请求成功才关弹层、撕下这一页。 */

function DeleteMember({ member, submitted, canDelete, disabled, onDeleted }: {
  member: Member
  submitted: boolean
  canDelete: boolean
  disabled: boolean
  onDeleted(member: Member): void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const blocked = submitted
    ? '这位成员曾经有过投稿，不能删。'
    : canDelete ? null : '这位成员投过票，不能删。'

  const confirm = async () => {
    if (busy) return
    primePaperAudio() // 撕纸声在请求完成后才响，先在这次点击里把音频上下文准备好
    setBusy(true)
    setError('')
    try {
      await removeMember(Number(member.id))
      setOpen(false)
      onDeleted(member)
    } catch (err) {
      setError(getApiErrorMessage(err, '删除成员失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (busy) return // 请求进行中不让关
        setOpen(next)
        setError('')
      }}
      side="bottom"
      align="end"
      label={blocked === null ? '确认删除成员' : '不能删除成员'}
      trigger={(
        <button type="button" className={styles.deleteButton} disabled={disabled}>删除</button>
      )}
      content={(close) => (
        <div className={styles.confirm}>
          {blocked === null ? (
            <>
              <p className={styles.confirmText}>确定删除成员「{member.nickname}」吗？此操作不可撤销。</p>
              {error !== '' && <p className={styles.confirmError} role="alert">{error}</p>}
              <div className={styles.confirmActions}>
                <button type="button" className={styles.headButton} disabled={busy} onClick={close}>取消</button>
                <button type="button" className={styles.deleteButton} disabled={busy} data-autofocus onClick={() => void confirm()}>
                  {busy ? '删除中…' : '删除'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.confirmText}>{blocked}</p>
              <div className={styles.confirmActions}>
                <button type="button" className={styles.headButton} data-autofocus onClick={close}>知道了</button>
              </div>
            </>
          )}
        </div>
      )}
    />
  )
}

/* ============================== 成员页（二级页面） ============================== */

type DetailPageProps = {
  mode: 'create' | 'edit'
  member?: Member
  canDelete: boolean
  submissions: MemberSubmission[] | null
  paging: Paging
  draft?: MemberFormDraft
  onDraftChange(draft: MemberFormDraft): void
  onBack(): void
  onSaved(saved?: { id: number | string }): void | Promise<void>
  /** 最宽布局：头像和“QQ 号 + 昵称”并排 */
  avatarBeside: boolean
  /** 删除请求已经成功：撕下这一页，回到名单 */
  onDeleted(member: Member): void
  onFlip(dir: 1 | -1): void
}

function DetailPage({ mode, member, canDelete, submissions, paging, draft, onDraftChange, onBack, onSaved, avatarBeside, onDeleted, onFlip }: DetailPageProps) {
  const title = useFocusOnMount()
  const form_id = useId()
  const [busy, setBusy] = useState(false)
  const total = submissions?.length ?? 0

  return (
    <div className={cn(styles.page, styles.detail)}>
      <div className={styles.pageHead}>
        <div className={styles.headLead}>
          <MarginButton label="返回名单簿" onClick={onBack}><BackIcon /></MarginButton>
          <h3 ref={title} className={styles.detailTitle} tabIndex={-1}>
            {mode === 'create' ? '新增成员' : `member_id=${member?.id}`}
          </h3>
        </div>
        <div className={styles.headActions}>
          {mode === 'edit' && member !== undefined && (
            <DeleteMember
              member={member}
              submitted={total > 0}
              canDelete={canDelete}
              disabled={busy}
              onDeleted={onDeleted}
            />
          )}
          <button type="submit" form={form_id} className={styles.saveButton} disabled={busy}>
            {busy ? '保存中…' : mode === 'create' ? '创建成员' : '保存修改'}
          </button>
        </div>
      </div>
      <div className={styles.detailBody}>
        <div className={styles.formColumn}>
          <MemberForm
            mode={mode}
            member={member}
            canDelete={canDelete}
            showHeading={false}
            embedded
            avatarBeside={avatarBeside}
            formId={form_id}
            draft={draft}
            onDraftChange={onDraftChange}
            onBusyChange={setBusy}
            onClose={onBack}
            onSaved={onSaved}
          />
        </div>
        <section className={styles.submissions} aria-label="过去的投稿">
          <div className={styles.sectionHead}>
            <span>过去的投稿</span>
            {submissions !== null && <span className={styles.count}>{total} 张</span>}
          </div>
          {submissions === null && <div className={cn(styles.card, styles.cardEmpty)}>新成员还没有投稿。</div>}
          {submissions !== null && total === 0 && <div className={cn(styles.card, styles.cardEmpty)}>还没有投稿。</div>}
          {total > 0 && submissions !== null && (
            <CollageCard photos={submissions.slice(0, paging.first)} perRow={paging.perRow} />
          )}
        </section>
      </div>
      {total > 0 && <Pager page={0} pages={sheetCount(total, paging)} label="投稿翻页" onFlip={onFlip} />}
    </div>
  )
}

/* ============================== 投稿续页（三级页面） ============================== */

type PrintsPageProps = {
  member: Member
  submissions: MemberSubmission[]
  sheet: number
  paging: Paging
  onBack(): void
  onFlip(dir: 1 | -1): void
}

function PrintsPage({ member, submissions, sheet, paging, onBack, onFlip }: PrintsPageProps) {
  const title = useFocusOnMount()
  const shown = submissions.slice(sheetStart(sheet, paging), sheetEnd(sheet, paging))
  const rows: MemberSubmission[][] = []
  for (let i = 0; i < shown.length; i += paging.perRow) {
    rows.push(shown.slice(i, i + paging.perRow))
  }

  return (
    <div className={cn(styles.page, styles.detail)}>
      <div className={styles.pageHead}>
        <div className={styles.headLead}>
          {/* 不管翻到第几张续页，都直接回到成员页 */}
          <MarginButton label="返回成员页" onClick={onBack}><BackIcon /></MarginButton>
          <h3 ref={title} className={styles.detailTitle} tabIndex={-1}>member_id={member.id}</h3>
        </div>
      </div>
      <div className={styles.printsBody}>
        <section className={styles.cardRows} aria-label={`过去的投稿，共 ${submissions.length} 张`}>
          {rows.map(row => <CollageCard key={row[0].id} photos={row} perRow={paging.perRow} slot={paging.slot} />)}
        </section>
      </div>
      <Pager page={sheet} pages={sheetCount(submissions.length, paging)} label="投稿翻页" onFlip={onFlip} />
    </div>
  )
}

/* ============================== 线圈本 ============================== */

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  /** sheet 0 是成员页（二级），≥ 1 是投稿续页（三级） */
  | { kind: 'edit'; id: string; sheet: number }

export type MemberNotebookProps = {
  members: Member[]
  memberCanDelete?: MemberCanDelete
  memberSubmissions?(member: Member): MemberSubmission[]
  onMembersChanged?(): void | Promise<void>
}

export function MemberNotebook({ members, memberCanDelete, memberSubmissions, onMembersChanged }: MemberNotebookProps) {
  const layout = useNotebookLayout()
  const root = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(root)

  const columns = LIST_COLUMNS[layout]
  const rows = Math.max(1, Math.floor((height - LIST_CHROME_PX) / ROW_PX))
  const per_page = rows * columns

  const per_row = PRINTS_PER_ROW[layout]
  const grid = printGrid(width, height, per_row)
  const paging: Paging = { first: per_row, rest: grid.rows * per_row, perRow: per_row, slot: grid.slot }

  const [view, setView] = useState<View>({ kind: 'list' })
  const [list_page, setListPage] = useState(0)
  // 名单页的身份只在真正翻页时变（翻页次数 + 翻页时的页码）；搜索导致的回到第 1 页不换纸，输入框也就不会被重新挂载
  const [list_flip, setListFlip] = useState({ n: 0, page: 0 })
  const [dir, setDir] = useState<FlipDir>('none')
  const [focus_id, setFocusId] = useState<string | null>(null)
  const [last_per_page, setLastPerPage] = useState(per_page)
  const [last_rest, setLastRest] = useState(paging.rest)
  const [search_open, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const search_focus_ref = useRef(false)
  // 刚删掉的成员：撕下来的那一页在动画期间还要画出他的内容，而 adminPool 刷新后他已经不在 members 里了
  const torn_ref = useRef<{ member: Member } | null>(null)
  // 每张名单纸最后一次作为当前页时画的页码。翻走中的纸按它来画，不按 key 里翻页那一刻的页码：
  // 搜索、从成员页返回、删除成员都会改页码但不换纸，key 里的页码那时已经过期（甚至超出页数，画出来就是空页）
  const list_shown_ref = useRef(new Map<string, number>())
  // 本次打开名单簿后新建的成员（显示“new”角标），和刚建好、等 adminPool 刷新后要翻到的那一位
  const [new_ids, setNewIds] = useState<ReadonlySet<string>>(() => new Set())
  const [pending_new, setPendingNew] = useState<string | null>(null)
  // 成员页没保存的输入。翻到续页时成员页会卸载，翻回来用它恢复
  const draft_ref = useRef<{ key: string; draft: MemberFormDraft } | null>(null)

  const listed = query.trim() === '' ? members : members.filter(m => matchMember(m, query))

  // 每页行数变了（换布局、侧栏变高）：按本页第一行换算页码，不播翻页
  if (last_per_page !== per_page) {
    const first = list_page * last_per_page
    const next = clampPage(Math.floor(first / per_page), listed.length, per_page)
    setLastPerPage(per_page)
    setDir('none')
    setListPage(next)
    setListFlip(f => ({ n: f.n + 1, page: next }))
  }

  // 续页每页张数变了：按当前续页第一张换算到新的纸页，不播翻页
  if (last_rest !== paging.rest) {
    setLastRest(paging.rest)
    if (view.kind === 'edit' && view.sheet > 0) {
      setDir('none')
      setView({ ...view, sheet: sheetOfPhoto(sheetStart(view.sheet, { ...paging, rest: last_rest }), paging) })
    }
  }

  // 新建的成员出现在名单里了：名单页码定到他那一页，返回时焦点也落在他那一行
  if (pending_new !== null) {
    const idx = listed.findIndex(m => String(m.id) === pending_new)
    if (idx >= 0) {
      setPendingNew(null)
      setListPage(Math.floor(idx / per_page))
      setFocusId(pending_new)
    }
  }

  const current_page = clampPage(list_page, listed.length, per_page)
  const member = view.kind === 'edit' ? members.find(m => String(m.id) === view.id) : undefined
  const submissions = member === undefined ? null : memberSubmissions?.(member) ?? []
  // 正在看的成员被删掉了（或刷新后不存在了）：翻回名单
  const member_gone = view.kind === 'edit' && member === undefined
  const shown_view: View = member_gone
    ? { kind: 'list' }
    : view.kind === 'edit'
      ? { ...view, sheet: clampSheet(view.sheet, submissions?.length ?? 0, paging) }
      : view

  const search: Search = {
    open: search_open,
    query,
    onOpen: () => {
      search_focus_ref.current = true
      setSearchOpen(true)
    },
    onChange: (q) => {
      setQuery(q)
      setListPage(0)
    },
    onClose: () => {
      setQuery('')
      setSearchOpen(false)
    },
    onClear: () => {
      setQuery('')
      setListPage(0)
      setSearchOpen(false)
    },
    takeFocus: () => {
      const take = search_focus_ref.current
      search_focus_ref.current = false
      return take
    },
  }

  const openMember = (m: Member) => {
    draft_ref.current = null
    playPageFlipSound()
    setDir('forward')
    setFocusId(null)
    setView({ kind: 'edit', id: String(m.id), sheet: 0 })
  }

  const openCreate = () => {
    draft_ref.current = null
    playPageFlipSound()
    setDir('forward')
    setFocusId(null)
    setView({ kind: 'create' })
  }

  const backToList = () => {
    draft_ref.current = null
    // 回到刚才那个成员所在的那一页（搜索中就是搜索结果里的那一页）
    if (view.kind === 'edit') {
      const idx = listed.findIndex(m => String(m.id) === view.id)
      if (idx >= 0) {
        setListPage(Math.floor(idx / per_page))
        setFocusId(view.id)
      }
    }
    playPageBackSound()
    setDir('backward')
    setView({ kind: 'list' })
  }

  const tearOff = (m: Member) => {
    draft_ref.current = null
    torn_ref.current = { member: m }
    // 撕下后停在原来那一页；被删的人不在了，这一页可能少一行
    const idx = listed.findIndex(x => x.id === m.id)
    if (idx >= 0) setListPage(Math.floor(idx / per_page))
    setFocusId(null)
    playPageTearSound()
    setDir('tear')
    setView({ kind: 'list' })
    void onMembersChanged?.()
  }

  const flipList = (step: 1 | -1) => {
    const next = clampPage(current_page + step, listed.length, per_page)
    if (next === current_page) return
    if (step > 0) playPageFlipSound()
    else playPageBackSound()
    setDir(step > 0 ? 'forward' : 'backward')
    setFocusId(null)
    setListPage(next)
    setListFlip(f => ({ n: f.n + 1, page: next }))
  }

  const flipSheet = (step: 1 | -1) => {
    if (shown_view.kind !== 'edit') return
    const next = clampSheet(shown_view.sheet + step, submissions?.length ?? 0, paging)
    if (next === shown_view.sheet) return
    if (step > 0) playPageFlipSound()
    else playPageBackSound()
    setDir(step > 0 ? 'forward' : 'backward')
    setView({ ...shown_view, sheet: next })
  }

  const backToDetail = () => {
    if (shown_view.kind !== 'edit') return
    playPageBackSound()
    setDir('backward')
    setView({ ...shown_view, sheet: 0 })
  }

  const saveDraft = (key: string) => (draft: MemberFormDraft) => {
    draft_ref.current = { key, draft }
  }

  // 页的身份：list:每页人数:翻页次数:翻页时的页码 / create / edit:成员 id:0 / edit:成员 id:续页号:每页张数
  // 成员页（sheet 0）不带每页张数，换布局时表单不会被重新挂载
  const page_key = shown_view.kind === 'list'
    ? `list:${per_page}:${list_flip.n}:${list_flip.page}`
    : shown_view.kind === 'create'
      ? 'create'
      : shown_view.sheet === 0
        ? `edit:${shown_view.id}:0`
        : `edit:${shown_view.id}:${shown_view.sheet}:${paging.rest}`

  return (
    <div ref={root} className={styles.notebook} data-layout={layout}>
      <div className={styles.backing} aria-hidden />
      <FlipStack
        className={styles.pages}
        pageKey={page_key}
        dir={member_gone ? 'backward' : dir}
        renderPage={(key) => {
          const [kind, a, b, c] = key.split(':')
          if (kind === 'list') {
            // 当前这张纸按最新的页码画（搜索会改页码但不换纸）；翻走中的纸按它自己 key 里的页码画
            const shown = list_shown_ref.current
            let page: number
            if (key === page_key) {
              page = current_page
              shown.delete(key)
              shown.set(key, page)
              if (shown.size > 8) shown.delete(shown.keys().next().value as string)
            } else {
              page = clampPage(shown.get(key) ?? Number(c), listed.length, Number(a))
            }
            return (
              <ListPage
                members={listed}
                total={members.length}
                page={page}
                perPage={Number(a)}
                columns={columns}
                focusId={focus_id}
                newIds={new_ids}
                search={search}
                onOpen={openMember}
                onCreate={openCreate}
                onFlip={flipList}
              />
            )
          }
          const torn = torn_ref.current
          const m = kind === 'edit'
            ? members.find(x => String(x.id) === a) ?? (torn !== null && String(torn.member.id) === a ? torn.member : undefined)
            : undefined
          if (kind === 'edit' && m === undefined) {
            return null // 被删掉（或刷新后不存在）的成员：翻走中的那一页只剩空白纸
          }
          const photos = m === undefined ? null : memberSubmissions?.(m) ?? []
          const sheet = kind === 'edit' ? Number(b) : 0
          if (m !== undefined && photos !== null && sheet > 0) {
            return (
              <PrintsPage
                member={m}
                submissions={photos}
                sheet={sheet}
                paging={paging}
                onBack={backToDetail}
                onFlip={flipSheet}
              />
            )
          }
          const draft_key = kind === 'create' ? 'create' : `edit:${a}`
          return (
            <DetailPage
              mode={kind === 'create' ? 'create' : 'edit'}
              member={m}
              canDelete={m !== undefined && (memberCanDelete?.(m) ?? false)}
              submissions={photos}
              paging={paging}
              draft={draft_ref.current?.key === draft_key ? draft_ref.current.draft : undefined}
              onDraftChange={saveDraft(draft_key)}
              onBack={backToList}
              onSaved={async (saved) => {
                if (kind === 'create' && saved !== undefined) {
                  const id = String(saved.id)
                  setNewIds(prev => new Set(prev).add(id))
                  setPendingNew(id)
                  // 新成员不一定符合当前的搜索：收起搜索，回到完整名单里找他
                  setQuery('')
                  setSearchOpen(false)
                }
                await onMembersChanged?.()
              }}
              avatarBeside={layout === 'L'}
              onDeleted={tearOff}
              onFlip={flipSheet}
            />
          )
        }}
      />
      <div className={styles.spiral} aria-hidden />
    </div>
  )
}
