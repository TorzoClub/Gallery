import React from 'react'

import './index.scss'

import PhotoBox from 'components/PhotoBox'

const SAME_HEIGHT = 100

export default class PhotoStream extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
    }
  }

  witchHeightIsMinimum = columns =>
    columns.indexOf(Math.min(...columns))

  computeColumnHeight = column =>
    column.length && column
      .map(photo => SAME_HEIGHT * (photo.height / photo.width))
      .reduce((a, b) => a + b)

  createColumns = () => {
    const columns = Array.from(
      Array(this.props.column_count)
    ).map(() => [])

    this.props.photos.forEach(photo => {
      const columnsHeight = columns.map(this.computeColumnHeight)

      const min_height_index = this.witchHeightIsMinimum(columnsHeight)
      columns[min_height_index].push(photo)
    })

    return columns
  }

  render() {
    const { screen, column_count, total_width } = this.props
    const { gutter = '0px' } = this.props

    const columns = this.createColumns()

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

    return <div
      className={`photo-stream ${ screen }`}
      style={{
        width: photoStreamListWidth
      }}
    >
      {
        columns.map((column, key) => (
          <div
            className="steam-column"
            key={ String(key) }
            style={ {
              width: `calc(${boxWidth})`
              // marginLeft: key ? '' : gutter,
              // marginRight: gutter,
              // paddingLeft: key ? '' : gutter,
              // paddingRight: gutter
            } }
          >
            {
              column.map(photo => (
                <PhotoBox
                  gallery={this.props.gallery}
                  screen={screen}
                  gutter={gutter}
                  photo={photo}
                  toDetail={this.props.toDetail}
                  width={ photo.width }
                  height={ photo.height }
                  boxWidth={ boxWidth }
                  key={ photo.id.toString() } />
              ))
            }
          </div>
        ))
      }
    </div>
  }
}
