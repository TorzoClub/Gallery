import { CSSProperties, Fragment, FunctionComponent, useEffect, useMemo } from 'react'

import './index.scss'

import { CoverClickEvent, UsePhotoBox, usePhotoBox } from 'components/PhotoBox'
import { globalQueueLoad } from 'utils/queue-load'
import { Gallery, Photo } from 'api/photo'
import { PhotoStreamState } from 'components/Gallery'

import PhotoBoxStyle from '../PhotoBox/index.scss'
import { updateListItem } from 'utils/common'

const SAME_HEIGHT = 100

type ColumnsHeightList = number[]

const whichMinimum = (columns: ColumnsHeightList) =>
  columns.indexOf(Math.min(...columns))

const computeColumnHeight = (columns: UsePhotoBox[]) =>
  columns
    .map(([, [ width, height ], { photo }]) => {
      return SAME_HEIGHT * (photo.height / photo.width)
    })
    .reduce((a, b) => a + b, 0)

const createColumns = (column_count: number, upb_list: UsePhotoBox[]) => {
  const init_columns: UsePhotoBox[][] = Array.from(Array(column_count)).map(() => [])
  return upb_list.reduce((columns, upb) => {
    const [, , { photo, avatar }] = upb
    if (avatar) globalQueueLoad(avatar.thumb)
    globalQueueLoad(photo.thumb)

    const height_list: ColumnsHeightList = columns.map(computeColumnHeight)

    const min_height_index = whichMinimum(height_list)

    return columns.map((col, idx) => {
      if (idx === min_height_index) {
        return [ ...col, upb ]
      } else {
        return col
      }
    })
  }, init_columns)
}

const Empty: FunctionComponent<{
  horizontalOffset: CSSProperties['width']
}> = ({ horizontalOffset }) => (
  <div style={{
    textAlign: 'center',
    width: '100%',
    color: 'rgba(0, 0, 0, 0.4)',
    padding: '30px 0',
    paddingLeft: horizontalOffset,
  }}>暂无投稿作品</div>
)

export type Props = {
  hideVoteButton: boolean
  gallery: Gallery
  screen: PhotoStreamState['screen']
  gutter: PhotoStreamState['column_gutter']
  column_count: PhotoStreamState['column_count']
  total_width: PhotoStreamState['gallery_width']

  photos: Photo[]
  onClickVote(photo_id: Photo['id']): void
  onClickCover(clickInfo: CoverClickEvent, photo: Photo['id']): void

  selectedIdList: number[]
}

export default (props: Props) => {
  const {
    hideVoteButton,
    gallery,
    screen,
    column_count,
    photos,
    total_width,
    gutter = '0px',
    selectedIdList
  } = props
  const isMobile = screen === 'mobile'

  let photoStreamListWidth: CSSProperties['width']
  if (isMobile) {
    photoStreamListWidth = `${total_width} - (${gutter} * 2)`
  } else {
    photoStreamListWidth = `${total_width} + ${gutter} * ${column_count - 1}`
  }

  let boxWidth: string
  if (isMobile) {
    boxWidth = `(((${photoStreamListWidth}) / ${column_count}) - (${gutter} / ${column_count}))`
  } else {
    boxWidth = `(${total_width} / ${column_count})`
  }

  const HorizontalOffset: CSSProperties['width'] = useMemo(() => {
    if (screen === 'normal') {
      return `calc(${PhotoBoxStyle['avatar-size']} / 2)`
    } else {
      return '0px'
    }
  }, [screen])

  const upb_list = photos.map(photo => (
    usePhotoBox({
      id: photo.id,
      screen,
      gutter,
      boxWidth,
      hideVoteButton,
      hideMember: !photo.member,
      voteIsHighlight: selectedIdList && (selectedIdList.indexOf(photo.id) !== -1),
      name: photo.member ? photo.member.name : null,
      desc: photo.desc,
      photo: {
        width: photo.width,
        height: photo.height,
        src: photo.src_url,
        thumb: photo.thumb_url,
      },
      avatar: photo.member ? {
        width: 0,
        height: 0,
        thumb: photo.member.avatar_thumb_url,
        src: photo.member.avatar_thumb_url,
      } : null,
      handleClickVote: () => {
        props.onClickVote(photo.id)
      },
      onClickCover: (fromInfo) => {
        props.onClickCover(fromInfo, photo.id)
      },
    })
  ))

  const columns = useMemo(() => {
    return createColumns(column_count, upb_list)
  }, [column_count, upb_list])

  return useMemo(() => (
    <div
      className={`photo-stream ${screen}`}
      style={{
        width: `calc(${photoStreamListWidth})`,
        paddingRight: HorizontalOffset,
      }}
    >
      {
        (photos.length === 0) ? (
          <Empty horizontalOffset={HorizontalOffset} />
        ) : columns.map((column, key) => (
          <div
            className="steam-column"
            key={String(key)}
            style={{
              width: `calc(${boxWidth})`
              // marginLeft: key ? '' : gutter,
              // marginRight: gutter,
              // paddingLeft: key ? '' : gutter,
              // paddingRight: gutter
            }}
          >
            {
              column.map(([photo_box, , { id }]) => {
                return <Fragment key={id}>{photo_box}</Fragment>
              })
            }
          </div>
        ))
      }
    </div>
  ), [HorizontalOffset, boxWidth, columns, photoStreamListWidth, photos.length, screen])
}
