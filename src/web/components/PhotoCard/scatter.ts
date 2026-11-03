/**
 * 相片卡片在瀑布流里“随手贴上去”的摆放：大小、倾角、横向位移、纵向错落。
 *
 * - 全部由相片 id 决定（不用 Math.random），刷新、缩放窗口、换列数后同一张相片的摆放不变。
 * - 瀑布流量的是外层格子；倾角和横向位移是卡片自身的 transform，不改变格子尺寸。
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

export function photoCardCover(card_width: number, photo: { width: number; height: number }) {
  const frame = photoCardFrame(card_width)
  const cover_width = Math.max(1, card_width - frame * 2)
  const ratio = photo.width > 0 && photo.height > 0 ? photo.height / photo.width : 1
  return { frame, cover_width, cover_height: cover_width * ratio }
}

/** 纸胶带探出卡片顶边的高度，与 .photo-card-tape 的 top 一致 */
export const PHOTO_CARD_TAPE_ROOM = 9

export const SCATTER_ROTATE_MIN = 0.8
export const SCATTER_ROTATE_MAX = 3

type ScatterInput = {
  id: number
  /** 瀑布流一列的宽度 */
  column_width: number
  column_gutter: number
  photo: { width: number; height: number }
  /** 描述字数，用来估算拍立得下方的高度（估多了只会让卡片小一点，不会碰撞得更厉害） */
  desc_length: number
  has_member: boolean
  /** ≤ 900px 的紧凑布局：卡片整体再小一些、错落浅一些 */
  tight: boolean
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

/** 估算卡片高度：白边 + 相片 + 下方留白（成员一行 + 描述若干行；都没有时只是一道白边） */
export function estimatePhotoCardHeight(
  card_width: number,
  photo: { width: number; height: number },
  desc_length: number,
  has_member: boolean,
): number {
  const { frame, cover_width, cover_height } = photoCardCover(card_width, photo)
  if (!photoCardHasBottom(has_member, desc_length)) {
    return frame + cover_height + frame
  }
  const per_line = Math.max(1, Math.floor((cover_width - 8) / 12))
  const desc_lines = desc_length > 0 ? Math.ceil(desc_length / per_line) : 0
  const content = (has_member ? 32 : 0) + desc_lines * 18 + (has_member && desc_lines > 0 ? 6 : 0) + 20
  return frame + cover_height + Math.max(photoCardBottomMin(card_width), content)
}

function rotatedBox(width: number, height: number, rotate: number) {
  const rad = (Math.abs(rotate) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { width: width * cos + height * sin, height: height * cos + width * sin }
}

export function getPhotoCardScatter(input: ScatterInput): PhotoCardScatter {
  const { id, column_width, column_gutter, photo, desc_length, has_member, tight } = input
  const random = seeded(id)
  const size_r = random()
  const angle_r = random()
  const sign = random() < 0.5 ? -1 : 1
  const x_r = random()
  const drop_r = random()
  // 新的随机量只能往后加，前面的顺序不变，已有相片的摆放才不会跟着变
  const tape_x_r = random()
  const tape_rotate_r = random()

  const size = tight ? 0.78 + 0.14 * size_r : 0.84 + 0.16 * size_r
  const rotate = sign * (SCATTER_ROTATE_MIN + (SCATTER_ROTATE_MAX - SCATTER_ROTATE_MIN) * angle_r)
  const allowed = column_width + column_gutter - 4

  const heightOf = (w: number) => estimatePhotoCardHeight(w, photo, desc_length, has_member)
  let card_width = Math.floor(column_width * size)
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
