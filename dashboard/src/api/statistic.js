import request from '@/utils/request'

export const getStatistic = () =>
  request({
    url: `admin/statistic`,
    method: 'GET',
  })
