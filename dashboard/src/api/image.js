import request from '@/utils/request'

export const refreshThumbs = () =>
  request({
    url: 'admin/image/refresh-thumb',
    method: 'GET',
    timeout: 0,
  })
