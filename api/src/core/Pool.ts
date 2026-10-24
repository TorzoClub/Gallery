import { Gallery, GalleryID } from './Gallery'
export type Pool = {
  galleries: Immutable.Map<GalleryID, Gallery>
}
