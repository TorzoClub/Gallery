import fs from 'fs'
import path from 'path'
import { Sequence } from 'vait'
import { diffGalleriesMap, Pool } from '../core/Pool'
import { MapStorageQueue } from './map-storage-queue'
import { GalleryID } from '../core/Gallery'
import { Gallery } from '../core/Gallery'

export default async function Storage({
  storage_path
}: { storage_path: string }) {
  const memberUpdatingQueue = Sequence()
  const poolUpdatingQueue = Sequence()

  const lockfile_path = path.join(storage_path, `lock`)

  function calcPoolJsonPath() {
    return path.join(storage_path, `pool.json`)
  }

  function calcGalleryJsonPath(gallery_id: GalleryID): string {
    return path.join(storage_path, 'gallries', `${gallery_id}.json`)
  }

  function calcMemberJsonPath() {
    return path.join(storage_path, `members.json`)
  }

  const galleriesStorage = MapStorageQueue<GalleryID, Gallery>({
    async create(gallery) {
      return fs.promises.writeFile(calcGalleryJsonPath(gallery.id), gallery)
    },
    async delete(gallery_id) {
      return fs.promises.unlink(calcGalleryJsonPath(gallery_id))
    },
    async update(new_gallery) {
      return fs.promises.writeFile(calcGalleryJsonPath(new_gallery.id), new_gallery)
    },
    async readRaw(gallery_id) {
      const json_text = fs.promises.readFile(calcGalleryJsonPath(gallery_id))
      return JSON.parse(json_text)
    },
  })

  function storedImagesEffect(latest: Pool, prev: Pool) {
    // todo: 刷新本地图库
    const stored_image_path = path.join(storage_path, 'stored-images')
    const source_image_path = path.join(stored_image_path, 'source')
    const thumb_image_path = path.join(stored_image_path, 'thumb')
  }

  function storeByDiff(latest: Pool, prev: Pool) {
    const galleries_diff = diffGalleriesMap(latest.galleries, latest.galleries)
    galleries_diff.adds.forEach(galleriesStorage.create)
    galleries_diff.dels.forEach(gallery => galleriesStorage.delete(gallery.id))
    galleries_diff.changes.forEach(galleriesStorage.update)

    const members_raw = latest.members.toJSON()
    memberUpdatingQueue(async () => {
      return fs.promises.writeFileSync(calcMemberJsonPath(), members_raw)
    })

    poolUpdatingQueue(async () => {
      await fs.promises.writeFileSync(calcPoolJsonPath(), {
        schema_version: latest.schema_version,
        next_id: latest.next_id,
      })
    })

    storedImagesEffect(latest, prev)
  }

  return {
    init(): Pool {
      // todo: 读取 storage_path 的数据,创建lockfile_path
    },
    free() {
      // todo: 移除lockfile
    },
    storeByDiff,
  }
}
