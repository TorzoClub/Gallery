import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'
import { useQueueload } from '../../../utils/queue-load'
import type { Member, MemberCanDelete, MemberSubmission } from './AdminConsole'
import { FlipStack, type FlipDir } from './FlipStack'
import { MemberForm, type MemberFormDraft } from './MemberForm'
import styles from './MemberNotebook.module.scss'

/* ============================== 布局 ==============================
 * 三种布局的断点与 AdminConsole.module.css / MemberNotebook.module.scss 完全一致：
 *   S  ≤ 640px   单面板，名单 1 列，拼贴每卡 2 张
 *   M  641–1439  控制台下方整行，名单 2 列，拼贴每卡 3 张
 *   L  ≥ 1440px  右侧常驻侧栏，名单 2 列，拼贴每卡 3 张
 * 名单每页行数、投稿续页的卡数都由线圈本的实际高度算出（S、M 高度固定，所以也固定；L 随侧栏高度变化）。 */

type Layout = 'S' | 'M' | 'L'

const MQ_M = '(min-width: 641px)'
const MQ_L = '(min-width: 1440px)'

const LIST_COLUMNS: Record<Layout, number> = { S: 1, M: 2, L: 2 }
const PRINTS_PER_PAGE: Record<Layout, number> = { S: 2, M: 3, L: 3 }

/** 名单行高；纸上的横线也是这个间距 */
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

function useElementHeight(ref: React.RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    setHeight(el.clientHeight)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return height
}

function pageCount(total: number, per_page: number) {
  return Math.max(1, Math.ceil(total / per_page))
}

function clampPage(page: number, total: number, per_page: number) {
  return Math.min(Math.max(page, 0), pageCount(total, per_page) - 1)
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

/* ============================== 名单页 ============================== */

type ListPageProps = {
  members: Member[]
  page: number
  perPage: number
  columns: number
  focusId: string | null
  onOpen(member: Member): void
  onCreate(): void
  onFlip(dir: 1 | -1): void
}

function ListPage({ members, page, perPage, columns, focusId, onOpen, onCreate, onFlip }: ListPageProps) {
  const root = useRef<HTMLDivElement>(null)
  const start = page * perPage
  const shown = members.slice(start, start + perPage)
  const pages = pageCount(members.length, perPage)

  // 从成员页翻回来时，焦点回到刚才打开的那一行
  useEffect(() => {
    if (focusId === null) return
    root.current?.querySelector<HTMLElement>(`[data-member-id="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true })
    // 只在这一页挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={root} className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.bookTitle}>名单簿</span>
        <div className={styles.headActions}>
          <span className={styles.count}>共 {members.length} 人</span>
          <button type="button" className={styles.headButton} onClick={onCreate}>新增成员</button>
        </div>
      </div>
      <div className={styles.listArea}>
        {members.length === 0 && <div className={styles.empty}>还没有成员。</div>}
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
                <span className={styles.no}>{String(start + i + 1).padStart(2, '0')}</span>
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

/* ============================== 拼贴的相片 ============================== */

/** 每个槽位的倾角（度）和纵向错落（槽宽的百分比），像随手贴上去 */
const SLOTS: Record<number, Array<{ rotate: number; drop: number }>> = {
  2: [{ rotate: -3, drop: 0 }, { rotate: 2.5, drop: 12 }],
  3: [{ rotate: -4, drop: 4 }, { rotate: 3, drop: 16 }, { rotate: -1.5, drop: 0 }],
}

/** 一张拼贴卡的高度，与 MemberNotebook.module.scss 的 .card 一致 */
const CARD_PX: Record<Layout, number> = { S: 184, M: 224, L: 224 }
/** 三级页面里拼贴卡之间的间距，与 .cardRows 的 gap 一致 */
const CARD_GAP_PX = 12
/** 三级页面里拼贴卡以外的固定高度：名单页的 122 + 正文上内边距 14 + “过去的投稿”小标题 22 + 8 */
const PRINTS_CHROME_PX = LIST_CHROME_PX + 14 + 30

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
      <figcaption className={styles.printCaption} title={photo.desc || undefined}>{photo.galleryName}</figcaption>
    </figure>
  )
}

/** 一张拼贴卡：一行 2～3 张。只有它所在的纸页被渲染时，里面的相片才会进 queue-load */
function CollageCard({ photos, perRow }: { photos: MemberSubmission[]; perRow: number }) {
  const slots = SLOTS[perRow] ?? SLOTS[3]
  return (
    <div className={styles.card}>
      <div className={styles.collage} style={{ '--slots': perRow } as React.CSSProperties}>
        {photos.map((p, i) => <Print key={p.id} photo={p} slot={slots[i % slots.length]} />)}
      </div>
    </div>
  )
}

/**
 * 投稿怎么分到纸页上：
 *   第 0 张纸是成员页（二级页面），表单下面放一张拼贴卡，共 first 张；
 *   之后每张纸是三级页面，整页都是拼贴卡，每张纸放 rest 张（= 放得下的卡数 × 每卡张数）。
 */
type Paging = { first: number; rest: number; perRow: number }

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

function SubmissionsHead({ total }: { total: number | null }) {
  return (
    <div className={styles.sectionHead}>
      <span>过去的投稿</span>
      {total !== null && <span className={styles.count}>{total} 张</span>}
    </div>
  )
}

function useFocusOnMount() {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
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
  onSaved(): void | Promise<void>
  onFlip(dir: 1 | -1): void
}

function DetailPage({ mode, member, canDelete, submissions, paging, draft, onDraftChange, onBack, onSaved, onFlip }: DetailPageProps) {
  const title = useFocusOnMount()
  const form_id = useId()
  const [busy, setBusy] = useState(false)
  const total = submissions?.length ?? 0

  return (
    <div className={cn(styles.page, styles.detail)}>
      <div className={styles.pageHead}>
        <div className={styles.headActions}>
          <button type="button" className={styles.backButton} onClick={onBack}>‹ 名单簿</button>
          <button type="submit" form={form_id} className={styles.saveButton} disabled={busy}>
            {busy ? '保存中…' : mode === 'create' ? '创建成员' : '保存修改'}
          </button>
        </div>
        <h3 ref={title} className={styles.detailTitle} tabIndex={-1}>
          {mode === 'create' ? '新增成员' : `member_id=${member?.id}`}
        </h3>
      </div>
      <div className={styles.detailBody}>
        <div className={styles.formColumn}>
          <MemberForm
            mode={mode}
            member={member}
            canDelete={canDelete}
            showHeading={false}
            embedded
            formId={form_id}
            draft={draft}
            onDraftChange={onDraftChange}
            onBusyChange={setBusy}
            onClose={onBack}
            onSaved={onSaved}
          />
        </div>
        <section className={styles.submissions} aria-label="过去的投稿">
          <SubmissionsHead total={submissions === null ? null : total} />
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
        <div className={styles.headActions}>
          {/* 不管翻到第几张续页，都直接回到成员页 */}
          <button type="button" className={styles.backButton} onClick={onBack}>‹ 返回</button>
        </div>
        <h3 ref={title} className={styles.detailTitle} tabIndex={-1}>member_id={member.id}</h3>
      </div>
      <div className={styles.printsBody}>
        <section className={styles.submissions} aria-label="过去的投稿">
          <SubmissionsHead total={submissions.length} />
          <div className={styles.cardRows}>
            {rows.map(row => <CollageCard key={row[0].id} photos={row} perRow={paging.perRow} />)}
          </div>
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
  const height = useElementHeight(root)

  const columns = LIST_COLUMNS[layout]
  const rows = Math.max(1, Math.floor((height - LIST_CHROME_PX) / ROW_PX))
  const per_page = rows * columns

  const per_row = PRINTS_PER_PAGE[layout]
  const card_rows = Math.max(1, Math.floor((height - PRINTS_CHROME_PX + CARD_GAP_PX) / (CARD_PX[layout] + CARD_GAP_PX)))
  const paging: Paging = { first: per_row, rest: card_rows * per_row, perRow: per_row }

  const [view, setView] = useState<View>({ kind: 'list' })
  const [list_page, setListPage] = useState(0)
  const [dir, setDir] = useState<FlipDir>('none')
  const [focus_id, setFocusId] = useState<string | null>(null)
  const [last_per_page, setLastPerPage] = useState(per_page)
  const [last_paging, setLastPaging] = useState(paging)
  // 成员页没保存的输入。翻到续页时成员页会卸载，翻回来用它恢复
  const draft_ref = useRef<{ key: string; draft: MemberFormDraft } | null>(null)

  // 每页行数变了（换布局、侧栏变高）：按本页第一行换算页码，不播翻页
  if (last_per_page !== per_page) {
    const first = list_page * last_per_page
    setLastPerPage(per_page)
    setDir('none')
    setListPage(clampPage(Math.floor(first / per_page), members.length, per_page))
  }

  // 投稿每页张数变了：按当前续页第一张换算到新的纸页，不播翻页
  if (last_paging.first !== paging.first || last_paging.rest !== paging.rest) {
    setLastPaging(paging)
    if (view.kind === 'edit' && view.sheet > 0) {
      setDir('none')
      setView({ ...view, sheet: sheetOfPhoto(sheetStart(view.sheet, last_paging), paging) })
    }
  }

  const current_page = clampPage(list_page, members.length, per_page)
  const member = view.kind === 'edit' ? members.find(m => String(m.id) === view.id) : undefined
  const submissions = member === undefined ? null : memberSubmissions?.(member) ?? []
  // 正在看的成员被删掉了（或刷新后不存在了）：翻回名单
  const member_gone = view.kind === 'edit' && member === undefined
  const shown_view: View = member_gone
    ? { kind: 'list' }
    : view.kind === 'edit'
      ? { ...view, sheet: clampSheet(view.sheet, submissions?.length ?? 0, paging) }
      : view

  const openMember = (m: Member) => {
    draft_ref.current = null
    setDir('forward')
    setFocusId(null)
    setView({ kind: 'edit', id: String(m.id), sheet: 0 })
  }

  const openCreate = () => {
    draft_ref.current = null
    setDir('forward')
    setFocusId(null)
    setView({ kind: 'create' })
  }

  const backToList = () => {
    draft_ref.current = null
    // 回到刚才那个成员所在的那一页
    if (view.kind === 'edit') {
      const idx = members.findIndex(m => String(m.id) === view.id)
      if (idx >= 0) {
        setListPage(Math.floor(idx / per_page))
        setFocusId(view.id)
      }
    }
    setDir('backward')
    setView({ kind: 'list' })
  }

  const flipList = (step: 1 | -1) => {
    setDir(step > 0 ? 'forward' : 'backward')
    setFocusId(null)
    setListPage(clampPage(current_page + step, members.length, per_page))
  }

  const flipSheet = (step: 1 | -1) => {
    if (shown_view.kind !== 'edit') return
    setDir(step > 0 ? 'forward' : 'backward')
    setView({ ...shown_view, sheet: clampSheet(shown_view.sheet + step, submissions?.length ?? 0, paging) })
  }

  const backToDetail = () => {
    if (shown_view.kind !== 'edit') return
    setDir('backward')
    setView({ ...shown_view, sheet: 0 })
  }

  const saveDraft = (key: string) => (draft: MemberFormDraft) => {
    draft_ref.current = { key, draft }
  }

  // 页的身份：list:每页人数:页码 / create / edit:成员 id:0 / edit:成员 id:续页号:每页张数
  // 成员页（sheet 0）不带每页张数，换布局时表单不会被重新挂载
  const page_key = shown_view.kind === 'list'
    ? `list:${per_page}:${current_page}`
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
          const [kind, a, b] = key.split(':')
          if (kind === 'list') {
            return (
              <ListPage
                members={members}
                page={Number(b)}
                perPage={Number(a)}
                columns={columns}
                focusId={focus_id}
                onOpen={openMember}
                onCreate={openCreate}
                onFlip={flipList}
              />
            )
          }
          const m = kind === 'edit' ? members.find(x => String(x.id) === a) : undefined
          if (kind === 'edit' && m === undefined) {
            return null // 刚删除的成员：翻走中的那一页只剩空白纸
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
              onSaved={onMembersChanged ?? (() => {})}
              onFlip={flipSheet}
            />
          )
        }}
      />
      <div className={styles.spiral} aria-hidden />
    </div>
  )
}
