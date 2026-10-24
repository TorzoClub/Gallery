import { query } from './dispatch'
import { normalizePhotoNormal, type PhotoNormal } from './photo'

type WirePhoto = Parameters<typeof normalizePhotoNormal>[0]

export const confirmQQNum = (qq_num: number) => query<{ value: boolean }>(
  'confirmMember',
  { qq_num },
).then(res => res.value)

export const getSubmissionByQQNum = (
  gallery_id: number | string,
  qq_num: number | string,
) => query<WirePhoto | null>('getSubmission', {
  gallery_id: Number(gallery_id),
  qq_num: Number(qq_num),
}).then(photo => photo === null ? null : normalizePhotoNormal(photo))
