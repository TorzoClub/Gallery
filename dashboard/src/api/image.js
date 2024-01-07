import request from '@/utils/request'

export const __AVATAR_THUMB_SIZE__ = 128

export const refreshThumb = (src, thumb_size) =>
  request({
    url: `admin/image/refresh-thumb`,
    method: 'POST',
    timeout: 0,
    data: { src, thumb_size },
  })

export const getAllAvailablePhoto = () =>
  request({
    url: `admin/image/available-photo`,
    method: 'GET',
    timeout: 0,
  })
