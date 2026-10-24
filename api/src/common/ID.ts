// Distinct (branded) ID types.

export type ID<T, DistinctName> = T & { readonly __TYPE__: DistinctName }

export type BrandedNumber<Name extends string> = ID<number, Name>

export type SchemaVersion = BrandedNumber<'schema_version'>
export type NextID = BrandedNumber<'next_id'>
export type GalleryID = BrandedNumber<'GalleryID'>
export type MemberID = BrandedNumber<'MemberID'>
export type PhotoID = BrandedNumber<'PhotoID'>
export type VoteID = BrandedNumber<'VoteID'>

export function Id<T, DistinctName>() {
  return (id: T) => id as ID<T, DistinctName>
}

export const asSchemaVersion = (id: number): SchemaVersion => id as SchemaVersion
export const asNextID = (id: number): NextID => id as NextID
export const asGalleryID = (id: number): GalleryID => id as GalleryID
export const asMemberID = (id: number): MemberID => id as MemberID
export const asPhotoID = (id: number): PhotoID => id as PhotoID
export const asVoteID = (id: number): VoteID => id as VoteID

export function maxId(items: readonly { id: number }[]): number {
  let max_id = 0
  for (const item of items) {
    if (item.id > max_id) {
      max_id = item.id
    }
  }
  return max_id
}
