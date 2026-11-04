/**
 * 相片卡片在瀑布流里“随手贴上去”的摆放：大小、倾角、横向位移、纵向错落。
 *
 * - 全部由相片 id 决定（不用 Math.random），刷新、缩放窗口、换列数后同一张相片的摆放不变。
 * - 瀑布流量的是外层格子；倾角和横向位移是卡片自身的 transform，不改变格子尺寸。
 * - 横长图（宽 ÷ 高 ≥ 2）转 90° 竖着贴，见 photoCardCover；转过之后就是竖长卡片。
 * - 竖长的卡片尽量摆正，见 uprightFor。“竖长”看整张卡片：相片竖长、横长图转过来、描述很长把写字区撑高，都算。
 *   卡片高度由 estimatePhotoCardHeight 估算，描述行数见 estimateDescLines。
 * - 不碰撞：卡片转过之后的外接框，横向始终落在“本列 + 两侧各半个列间距 − 2px”之内，
 *   相邻两列各占一半列间距，所以永远不会压到隔壁；放不下就把卡片缩小，而不是减小倾角。
 * - 纵向：倾斜多出来的上下高度、纸胶带探出卡片顶边的部分，都折进格子的上下留白，参与瀑布流排布。
 */

/** 拍立得白边：卡片宽度的 4.5%，6～12px */
export function photoCardFrame(card_width: number): number {
  return Math.min(12, Math.max(6, Math.round(card_width * 0.045)))
}

/**
 * 拍立得下方有没有写字区：有成员（非活动中的相片、后台）或有描述才有。
 * 活动中的公开相片不显示作者，没有描述时下方只留与四周一样宽的白边。
 */
export function photoCardHasBottom(has_member: boolean, desc_length: number): boolean {
  return has_member || desc_length > 0
}

/** 拍立得下方留白（头像、昵称、描述所在）的最小高度 */
export function photoCardBottomMin(card_width: number): number {
  return Math.max(48, Math.round(photoCardFrame(card_width) * 4.5))
}

/**
 * 横长图竖着贴：宽 ÷ 高 ≥ 这个值的相片，在拍立得里顺时针转 90° 竖着放（原图顶边朝右）。
 * 只是前端显示的事：不重新生成图片、不改 storage，也不经过 canvas（Safari 把 AVIF 画进 canvas 会出白图）。
 * 16:9 这类普通宽图（≈ 1.78）不转。
 */
export const SIDEWAYS_RATIO = 2

/** 这张相片要不要转 90° 竖着贴，见 SIDEWAYS_RATIO */
export function photoIsSideways(photo: { width: number; height: number }): boolean {
  return photo.width > 0 && photo.height > 0 && photo.width / photo.height >= SIDEWAYS_RATIO
}

/**
 * 拍立得里相片区域（.cover-area）的尺寸。所有要知道卡片尺寸的地方（PhotoCard、瀑布流高度估算、防碰撞、
 * 投稿表单、后台磁粒）都只能从这里取，横长图转 90° 才会处处一致。
 *
 * sideways 时 cover_width × cover_height 是转过之后竖着的框；里面的 <img> 宽高对调（cover_height × cover_width）
 * 再 rotate(90deg) 正好填满这个框。
 */
export function photoCardCover(card_width: number, photo: { width: number; height: number }) {
  const frame = photoCardFrame(card_width)
  const cover_width = Math.max(1, card_width - frame * 2)
  const sideways = photoIsSideways(photo)
  const ratio = photo.width > 0 && photo.height > 0
    ? (sideways ? photo.width / photo.height : photo.height / photo.width)
    : 1
  return { frame, cover_width, cover_height: cover_width * ratio, sideways }
}

/** 纸胶带探出卡片顶边的高度，与 .photo-card-tape 的 top 一致 */
export const PHOTO_CARD_TAPE_ROOM = 9

export const SCATTER_ROTATE_MIN = 0.8
export const SCATTER_ROTATE_MAX = 3

/**
 * 竖长的卡片尽量摆正：同样的倾角，卡片越高，底边相对顶边横移得越多
 * （1300px 高的卡片斜 2°，底边就偏出去约 45px），看上去像要滑下来。
 * 卡片高宽比 ≤ TALL_FROM 时倾角不变；≥ TALL_UPRIGHT 时只留 ±TALL_ROTATE，几乎是正的；中间线性过渡。
 * 倾斜方向仍由相片 id 决定，所以摆正之后也还是“随手贴的”。
 */
export const TALL_FROM = 1.4
export const TALL_UPRIGHT = 2.4
export const TALL_ROTATE = 0.3

type ScatterInput = {
  id: number
  /** 瀑布流一列的宽度 */
  column_width: number
  column_gutter: number
  photo: { width: number; height: number }
  /** 描述原文（已 trim），用来估算拍立得下方的高度（估多了只会让卡片小一点、更正一点，不会碰撞得更厉害） */
  desc: string
  has_member: boolean
  /** ≤ 900px 的紧凑布局：卡片整体再小一些、错落浅一些 */
  tight: boolean
  /** ≤ 640px 的双列布局：卡片放大到列宽的 92%～100%（错落仍按 tight） */
  duo?: boolean
}

export type PhotoCardScatter = {
  card_width: number
  /** 度；正数顺时针 */
  rotate: number
  /** 相对列中线的横向位移，px */
  offset_x: number
  /** 纸胶带：translateX 百分比（-55～-45）和倾角（-3°～3°） */
  tape_x: number
  tape_rotate: number
  pad_top: number
  pad_bottom: number
}

/** mulberry32：同一个种子永远得到同一串 [0, 1) 的数 */
function seeded(seed: number) {
  let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 描述的字号与行高，与 .desc-block 一致 */
const DESC_FONT = 13
const DESC_LINE = 18
/** 投票时写字区右侧给磁粒让出的宽度，与 .bottom-area.has-vote .desc-block 的 padding-right 一致 */
export const DESC_VOTE_ROOM = 44
/** 描述首尾的引号装饰（1.5em 粗体弯引号 + 2px 间距）大约占的宽度 */
const DESC_QUOTE = 12

/** 一个字符在 13px 手写体里大约多宽：全角（中日韩、全角标点、emoji）1em，其余约 0.6em */
function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0
  const wide = code >= 0x1100 && (
    code <= 0x115f
    || (code >= 0x2e80 && code <= 0xa4cf)
    || (code >= 0xac00 && code <= 0xd7a3)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0xfe30 && code <= 0xfe4f)
    || (code >= 0xff00 && code <= 0xff60)
    || (code >= 0xffe0 && code <= 0xffe6)
    || code >= 0x1f300
  )
  return wide ? DESC_FONT : DESC_FONT * 0.6
}

/**
 * 估算描述占几行：.desc-block 是 white-space: pre-line + overflow-wrap: anywhere，
 * 所以回车一定换行、空行也占一行，一行写满就在任意字符处折行。
 */
export function estimateDescLines(desc: string, line_width: number): number {
  if (desc.length === 0) {
    return 0
  }
  const width = Math.max(DESC_FONT, line_width)
  const paragraphs = desc.split(/\r?\n/)
  let lines = 0
  paragraphs.forEach((paragraph, index) => {
    let used = index === 0 ? DESC_QUOTE : 0
    let count = 1
    for (const char of paragraph.replace(/[ \t]+/g, ' ')) {
      const w = charWidth(char)
      if (used + w > width && used > 0) {
        count += 1
        used = 0
      }
      used += w
    }
    if (index === paragraphs.length - 1 && used + DESC_QUOTE > width) {
      count += 1
    }
    lines += count
  })
  return lines
}

/**
 * 估算卡片高度：白边 + 相片 + 下方留白（成员一行 + 描述若干行；都没有时只是一道白边）。
 *
 * 没有作者的相片（活动中的公开相片）按写字区右侧少 DESC_VOTE_ROOM 估：投票期间磁粒只会出现在这类相片的右下角。
 * 不看“当前用户能不能投票”，否则确认 QQ 前后卡片的大小和倾角会变。
 */
export function estimatePhotoCardHeight(
  card_width: number,
  photo: { width: number; height: number },
  desc: string,
  has_member: boolean,
): number {
  const { frame, cover_width, cover_height } = photoCardCover(card_width, photo)
  if (!photoCardHasBottom(has_member, desc.length)) {
    return frame + cover_height + frame
  }
  // .bottom-area 左右各 2px 内边距
  const line_width = cover_width - 4 - (has_member ? 0 : DESC_VOTE_ROOM)
  const desc_lines = estimateDescLines(desc, line_width)
  const content = (has_member ? 32 : 0) + desc_lines * DESC_LINE + (has_member && desc_lines > 0 ? 6 : 0) + 20
  return frame + cover_height + Math.max(photoCardBottomMin(card_width), content)
}

/** 按卡片高宽比把倾角往正里收：见 TALL_FROM / TALL_UPRIGHT */
export function uprightFor(angle: number, aspect: number): number {
  const t = Math.min(1, Math.max(0, (aspect - TALL_FROM) / (TALL_UPRIGHT - TALL_FROM)))
  return angle + (Math.min(angle, TALL_ROTATE) - angle) * t
}

function rotatedBox(width: number, height: number, rotate: number) {
  const rad = (Math.abs(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { width: width * cos + height * sin, height: height * cos + width * sin }
}

export function getPhotoCardScatter(input: ScatterInput): PhotoCardScatter {
  const { id, column_width, column_gutter, photo, desc, has_member, tight } = input
  const random = seeded(id)
  const size_r = random()
  const angle_r = random()
  const sign = random() < 0.5 ? -1 : 1
  const x_r = random()
  const drop_r = random()
  // 新的随机量只能往后加，前面的顺序不变，已有相片的摆放才不会跟着变
  const tape_x_r = random()
  const tape_rotate_r = random()

  const size = input.duo ? 0.92 + 0.08 * size_r : tight ? 0.78 + 0.14 * size_r : 0.84 + 0.16 * size_r
  const allowed = column_width + column_gutter - 4

  const heightOf = (w: number) => estimatePhotoCardHeight(w, photo, desc, has_member)
  let card_width = Math.floor(column_width * size)

  // 高宽比按缩小之前的卡片算（缩小只会让它更瘦高一点点），倾角定下来之后不再随宽度变
  const angle = SCATTER_ROTATE_MIN + (SCATTER_ROTATE_MAX - SCATTER_ROTATE_MIN) * angle_r
  const rotate = sign * uprightFor(angle, heightOf(card_width) / Math.max(1, card_width))
  while (card_width > 40 && rotatedBox(card_width, heightOf(card_width), rotate).width > allowed) {
    card_width -= 2
  }

  const box = rotatedBox(card_width, heightOf(card_width), rotate)
  // 卡片可以略微越过列边，但最多越过四分之一个列间距，看上去仍是“这一列的”
  const slack = Math.max(0, Math.min((allowed - box.width) / 2, (column_width - card_width) / 2 + column_gutter / 4))
  const offset_x = Math.round((x_r * 2 - 1) * slack)

  const overflow_y = Math.ceil((box.height - heightOf(card_width)) / 2)
  const drop = Math.round(drop_r * (tight ? 12 : 24))

  return {
    card_width,
    rotate: Math.round(rotate * 100) / 100,
    offset_x,
    tape_x: Math.round((-55 + 10 * tape_x_r) * 10) / 10,
    tape_rotate: Math.round((-3 + 6 * tape_rotate_r) * 10) / 10,
    pad_top: PHOTO_CARD_TAPE_ROOM + overflow_y + drop,
    pad_bottom: overflow_y,
  }
}
