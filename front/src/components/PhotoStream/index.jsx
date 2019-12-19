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
    const { column_count, total_width } = this.props
    const { gutter = '0px' } = this.props

    const columns = this.createColumns()

    // ${gutter} * 2 + (${gutter} / 2)

    return <div
      className="photo-stream"
      style={{
        width: `calc(${total_width} + ${gutter} * ${column_count - 1})`
      }}
    >
      {
        columns.map((column, key) => (
          <div
            className="steam-column"
            key={ String(key) }
            style={ {
              width: `calc(${total_width} / ${column_count})`
              // marginLeft: key ? '' : gutter,
              // marginRight: gutter,
              // paddingLeft: key ? '' : gutter,
              // paddingRight: gutter
            } }
          >
            {
              column.map(photo => (
                <PhotoBox
                  photo={photo}
                  toDetail={this.props.toDetail}
                  width={ photo.width }
                  height={ photo.height }
                  boxWidth={`(${total_width} / ${column_count})`}
                  key={ photo.id.toString() } />
              ))
            }
          </div>
        ))
      }
    </div>
  }
}
