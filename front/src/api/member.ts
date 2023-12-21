import request from 'utils/request'
import { PhotoNormal } from './photo'

export const confirmQQNum = (qq_num: number) => request<{ value: boolean }>({
  method: 'GET',
  url: `member/confirm/${qq_num}`
}).then(res => res.value)

export const getSubmissionByQQNum = (
  gallery_id: number | string, qq_num: number | string
) => request<PhotoNormal | null>({
  method: 'GET',
  url: `gallery/${gallery_id}/submission/${qq_num}`
})
