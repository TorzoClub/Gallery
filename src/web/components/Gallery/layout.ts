export type GalleryLayout = {
  column_count: number
  gallery_width: number
  column_gutter: number
  vertical_gutter: number
  /** ≤ 900px 的紧凑布局：PhotoCard 散落得更小、更浅 */
  tight: boolean
  /** ≤ 640px 的双列布局：留白和列间距收窄、卡片放大，小屏尽量把相片放大 */
  duo: boolean
}

/** 宽屏列间距：给倾斜和横向位移留出余地（两列各占一半） */
const WIDE_GUTTER = 32
/** 超过这个宽度，公开页不再使用固定列数，按视口自动增加列数 */
const WIDE_AUTO_COLUMN_BREAKPOINT = 1535
/** ≤ 900px 的列间距 */
const TIGHT_GUTTER = 20
/** ≤ 640px 双列：瀑布流左右留白、列间距。外侧卡片最多越过列边半个列间距（5px），仍留在屏幕里 */
const DUO_SIDE = 8
const DUO_GUTTER = 10

const fixedLayout = ({
  column_count,
  gallery_width,
  column_gutter,
  tight,
  duo = false,
}: Pick<GalleryLayout, 'column_count' | 'gallery_width' | 'column_gutter' | 'tight'> & { duo?: boolean }): GalleryLayout => ({
  tight,
  duo,
  column_count,
  gallery_width,
  column_gutter,
  vertical_gutter: tight ? TIGHT_GUTTER : 27,
})

function computeColumnCountByBoxWidth(
  gallery_width: number,
  box_width: number,
  column_gutter: number,
  count = 0
) {
  const column_gutter_total = (count - 1) * column_gutter
  if (gallery_width < (box_width + column_gutter_total)) {
    return count
  } else {
    return computeColumnCountByBoxWidth(
      gallery_width - box_width,
      box_width,
      column_gutter,
      count + 1
    )
  }
}

function computeGalleryWidthWithAutoColumnCount(
  max_gallery_width: number,
  column_gutter: number,
  box_width: number,
) {
  const column_count = computeColumnCountByBoxWidth(
    max_gallery_width,
    box_width,
    column_gutter,
  )
  return {
    gallery_width: (box_width * column_count) + ((column_count - 1) * column_gutter),
    column_count
  } as const
}

const getLayoutConfigure = (viewport_width: number): GalleryLayout => {
  if (viewport_width > WIDE_AUTO_COLUMN_BREAKPOINT) {
    const box_width = 232
    const column_gutter = 27
    const padding_horizontal = 54
    return fixedLayout({
      tight: false,
      column_gutter,
      ...computeGalleryWidthWithAutoColumnCount(
        viewport_width - (2 * padding_horizontal),
        column_gutter,
        box_width,
      ),
    })
  } else if (viewport_width > 1450) {
    return fixedLayout({ tight: false, gallery_width: 1200, column_count: 4, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 1150) {
    return fixedLayout({ tight: false, gallery_width: 900, column_count: 4, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 900) {
    return fixedLayout({ tight: false, gallery_width: 750, column_count: 3, column_gutter: WIDE_GUTTER })
  } else if (viewport_width > 640) {
    return fixedLayout({ tight: true, gallery_width: 640 - TIGHT_GUTTER * 2, column_count: 3, column_gutter: TIGHT_GUTTER })
  } else {
    return fixedLayout({
      tight: true,
      duo: true,
      gallery_width: viewport_width - DUO_SIDE * 2,
      column_count: 2,
      column_gutter: DUO_GUTTER,
    })
  }
}

export function getGalleryLayoutForWidth(viewport_width: number): GalleryLayout {
  return getLayoutConfigure(viewport_width)
}

/**
 * 后台内容最宽 1400px，不能沿用公开页 >1535px 的自动列数。
 * 1535 是公开页进入自动列数前最后一个固定布局：1200px、4 列。
 */
export function getAdminGalleryLayoutForWidth(viewport_width: number): GalleryLayout {
  return getLayoutConfigure(Math.min(viewport_width, WIDE_AUTO_COLUMN_BREAKPOINT))
}

export function galleryColumnWidth(layout: GalleryLayout): number {
  return (layout.gallery_width - layout.column_gutter * (layout.column_count - 1)) / layout.column_count
}

export function sameGalleryLayout(a: GalleryLayout, b: GalleryLayout): boolean {
  return a.column_count === b.column_count
    && a.gallery_width === b.gallery_width
    && a.column_gutter === b.column_gutter
    && a.vertical_gutter === b.vertical_gutter
    && a.tight === b.tight
    && a.duo === b.duo
}
