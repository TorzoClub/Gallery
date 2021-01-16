import request from '@/utils/request'

export const create = data =>
  request({
    url: 'admin/member',
    method: 'POST',
    data
  })

export const remove = id =>
  request({
    url: `admin/member/${id}`,
    method: 'DELETE'
  })

export const getDetail = id =>
  request({
    url: `admin/member/${id}`,
    method: 'get'
  })

export const getList = () =>
  request({
    url: 'admin/member',
    method: 'get'
  })

export const update = (id, data) =>
  request({
    url: `admin/member/${id}`,
    method: 'patch',
    data
  })

export const setRetryVote = ({ id, gallery_id }) =>
  request({
    url: `admin/member/${id}/gallery/${gallery_id}/vote`,
    method: 'delete'
  })
