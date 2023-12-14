import request from '@/utils/request'

export const create = data =>
  request({
    url: 'admin/photo',
    method: 'POST',
    data
  })

export const remove = id =>
  request({
    url: `admin/photo/${id}`,
    method: 'DELETE'
  })

export const getDetail = id =>
  request({
    url: `admin/photo/${id}`,
    method: 'get'
  })

export const getList = gallery_id =>
  request({
    url: `admin/gallery/${gallery_id}/photo`,
    method: 'get'
  })

export const update = (id, data) =>
  request({
    url: `admin/photo/${id}`,
    method: 'patch',
    data
  })

export const sortByVoteCount = ({ gallery_id }) =>
  request({
    url: `admin/gallery/${gallery_id}/photo/sortByVoteCount`,
    method: 'PUT'
  })
