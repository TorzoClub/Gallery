import request from '@/utils/request'

export const create = data =>
  request({
    url: 'admin/gallery',
    method: 'POST',
    data
  })

export const remove = id =>
  request({
    url: `admin/gallery/${id}`,
    method: 'DELETE'
  })

export const getDetail = id =>
  request({
    url: `admin/gallery/${id}`,
    method: 'get'
  })

export const getList = () =>
  request({
    url: 'admin/gallery',
    method: 'get'
  })

export const update = (id, data) =>
  request({
    url: `admin/gallery/${id}`,
    method: 'patch',
    data
  })

export const getMemberVoteList = gallery_id =>
  request({
    url: `admin/gallery/${gallery_id}/member_vote`,
    method: 'get'
  })
