import React from 'react'

import './index.scss'

import PhotoBox from 'components/PhotoBox'

const SAME_HEIGHT = 100

const witchHeightIsMinimum = columns =>
  columns.indexOf(Math.min(...columns))

const computeColumnHeight = column => 
  column
    .map(photo => SAME_HEIGHT * (photo.height / photo.width))
    .reduce((a, b) => a + b, 0)

const createColumns = (column_count, photos) => {
  const columns = Array.from(Array(column_count)).map(() => [])

  photos.forEach(photo => {
    // console.log('photo', photo)
    const columnsHeight = columns.map(computeColumnHeight)

    const min_height_index = witchHeightIsMinimum(columnsHeight)
    columns[min_height_index].push(photo)
  })

  return columns
}

export default (props) => {
  const { screen, column_count, photos, total_width, gutter = '0px' } = props

  const columns = createColumns(column_count, photos)

  const isMobile = screen === 'mobile'

  let photoStreamListWidth
  if (isMobile) {
    photoStreamListWidth = `calc(100vw - ${gutter} * ${column_count} + (${gutter} / 2))`
  } else {
    photoStreamListWidth = `calc(${total_width} + ${gutter} * ${column_count - 1})`
  }

  let boxWidth
  if (isMobile) {
    boxWidth = `(${total_width} / ${column_count} - ${gutter})`
  } else {
    boxWidth = `(${total_width} / ${column_count})`
  }

  return (
    <div
      className={`photo-stream ${screen}`}
      style={{
        width: photoStreamListWidth
      }}
    >
      {
        columns.map((column, key) => (
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
              column.map(photo => (
                <PhotoBox
                  gallery={props.gallery}
                  screen={screen}
                  gutter={gutter}
                  photo={photo}
                  toDetail={props.toDetail}
                  width={photo.width}
                  height={photo.height}
                  boxWidth={boxWidth}
                  key={photo.id.toString()} />
              ))
            }
          </div>
        ))
      }
    </div>
  )
}
