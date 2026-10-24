import { Photo, PhotoID } from '../core/Photo'
import { QQNumber } from '../core/Member'

type Image = {
}

async function createImage() {

}

async function createPhoto(id: PhotoID, member_qq_num: QQNumber): Promise<Photo> {
  return {
    id,
    desc: '',
    format: 'jpg',
    width: 0,
    height: 0,
    member_qq_num
  }
}
