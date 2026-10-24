import Immutable from 'immutable'
import { Gallery, GalleryID, gallerySubmitVoteRecord, gallerySetSubmission, galleryCancelSubmission } from './Gallery'
import { Member, QQNumber, updateMember } from './Member'
import { Photo, PhotoID } from './Photo'
export type Pool = {
  schema_version: 1,
  next_id: number
  galleries: Immutable.Map<GalleryID, Gallery>
  members: Immutable.Map<QQNumber, Member>
}

export function diffGalleriesMap(map_new: Pool['galleries'], map_prev: Pool['galleries']) {
  return map_new.reduce(({ dels, adds, changes }, item_new) => {
    const item_prev = map_prev.get(item_new.id)
    if (item_prev) {
      const new_dels = dels.delete(item_new.id)
      if (item_prev !== item_new) {
        return { adds, dels: new_dels, changes: changes.set(item_prev.id, item_new) }
      } else {
        return { adds, changes, dels: new_dels }
      }
    } else {
      return { dels, changes, adds: adds.set(item_new.id, item_new) }
    }
  }, {
    dels: map_prev,
    adds: Immutable.Map<GalleryID, Gallery>(),
    changes: Immutable.Map<GalleryID, Gallery>(),
  })
}

export function createPool(galleries: Gallery[], members: Member[]): Pool {
  return {
    schema_version: 1,
    next_id: 1,
    galleries: Immutable.Map<GalleryID, Gallery>(
      galleries.map((gallery) => [gallery.id, gallery])
    ),
    members: Immutable.Map<QQNumber, Member>(
      members.map((member) => [member.qq_num, member])
    )
  }
}

export function poolCreateGallery(pool: Pool, gallery_form: Omit<Gallery, 'id'>): Pool {
  const id = pool.next_id as Gallery['id']
  if (pool.galleries.get(id)) {
    throw new Error(`Gallery(id=${id}) already exists.`)
  } else {
    return updatePool(pool, {
      next_id: id + 1,
      galleries: pool.galleries.set(id, { id, ...gallery_form })
    })
  }
}

function memberExists(pool: Pool, member_qq_num: QQNumber): boolean {
  return pool.members.has(member_qq_num)
}

const updatePool = (pool: Pool, items: Partial<Pool>): Pool => ({ ...pool, ...items })

function throwError(msg: string): never {
  throw new Error(msg)
}

function pickGallery(pool: Pool, galleryId: GalleryID): Gallery {
  return pool.galleries.get(galleryId) ?? throwError(`Gallery(id=${galleryId}) not found.`)
}

function pickMember(pool: Pool, member_qq_num: QQNumber): Member {
  return pool.members.get(member_qq_num) ?? throwError(`Member(qq_num=${member_qq_num}) not found.`)
}

export function poolVotePhoto(pool: Pool, now: Date, gallery_id: GalleryID, photo_id: PhotoID, member_qq_num: QQNumber): Pool {
  return updatePool(pool, {
    galleries: pool.galleries.set(
      gallery_id,
      gallerySubmitVoteRecord(now, pickGallery(pool, gallery_id), photo_id, member_qq_num)
    )
  })
}

export function poolSetSubmission(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  member_qq_num: QQNumber,
  new_photo: Photo
): Pool {
  return updatePool(pool, {
    galleries: pool.galleries.set(
      gallery_id,
      gallerySetSubmission(
        pickGallery(pool, gallery_id),
        now,
        pickMember(pool, member_qq_num).qq_num,
        new_photo,
      )
    )
  })
}

export function poolCancelSubmission(
  pool: Pool,
  now: Date,
  gallery_id: GalleryID,
  member_qq_num: QQNumber,
  new_photo: Photo
) {
  return updatePool(pool, {
    galleries: pool.galleries.set(
      gallery_id,
      galleryCancelSubmission(
        pickGallery(pool, gallery_id),
        now,
        member_qq_num,
        new_photo,
      )
    )
  })
}

export function poolAddMember(pool: Pool, member: Member): Pool {
  if (memberExists(pool, member.qq_num)) {
    throw new Error(`Member(qq_num=${member.qq_num}) already exists.`)
  } else {
    return updatePool(pool, {
      members: pool.members.set(member.qq_num, member)
    })
  }
}

export function poolRemoveMember(pool: Pool, member_qq_num: QQNumber): Pool {
  if (!memberExists(pool, member_qq_num)) {
    throw new Error(`Member(qq_num=${member_qq_num}) does not exist.`)
  } else {
    return updatePool(pool, {
      members: pool.members.remove(member_qq_num)
    })
  }
}

export function poolUpdateMember(pool: Pool, member_qq_num: QQNumber, items: Omit<Partial<Member>, 'qq_num'>): Pool {
  if (!memberExists(pool, member_qq_num)) {
    throw new Error(`Member(qq_num=${member_qq_num}) does not exist.`)
  } else {
    const updated_member = updateMember(pickMember(pool, member_qq_num), items)
    return updatePool(pool, {
      members: pool.members.set(member_qq_num, updated_member)
    })
  }
}
