import React from 'react'

import './index.scss'

import Title from 'components/Title'
import PhotoStream from 'components/PhotoStream'

class Gallery extends React.Component {
  constructor(props) {
    super(props)
    this.state = this.getPhotoStreamState()
  }

  getPhotoStreamState() {
    let state = null
    if (window.innerWidth > 1200) {
      state = {
        screen: 'normal',
        column_count: 4,
        gallery_width: `1200px`,
        column_gutter: '24px'
      }
    } else if (window.innerWidth > 640) {
      state = {
        screen: 'normal',
        column_count: 3,
        gallery_width: `640px`,
        column_gutter: '16px'
      }
    } else {
      state = {
        screen: 'mobile',
        column_count: 2,
        gallery_width: `100vw`,
        column_gutter: '12px'
      }
    }
    return state
  }

  setPhotoStreamState = () => {
    const { lastWidth } = this
    const { innerWidth } = window
    if (lastWidth !== innerWidth) {
      this.lastWidth = innerWidth
      console.warn('setPhotoStreamState')
      this.setState(this.getPhotoStreamState())
    }
  }

  componentWillMount() {
    this.setPhotoStreamState()
    window.addEventListener('resize', this.setPhotoStreamState)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.setPhotoStreamState)
  }

  render = () => {
    const { screen, column_count, gallery_width, column_gutter } = this.state
    const { gallery, toDetail } = this.props

    return (
      <div className="gallery">
        <Title>{ gallery.name }</Title>

        <PhotoStream
          toDetail={toDetail}
          screen={ screen }
          column_count={ column_count }
          total_width={ gallery_width }
          gallery={ gallery }
          photos={ gallery.photos }
          gutter={ column_gutter }
        />
      </div>
    )
  }
}

export default Gallery
