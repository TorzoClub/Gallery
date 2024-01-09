const assert = require('assert');
const { constructEnvironment, adminGetStatistic, prepareData } = require("./common")

describe('Dashboard Home statistic', () => {
  it('should shuccessfully get Dashboard Home statistic', async () => {
    const { app, token } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2001'),
        event_end: new Date('2002')
      }
    })

    const statistic = await adminGetStatistic(token, app, 200)
    assert(typeof statistic === 'object')
    assert(typeof statistic.available_photo_count === 'number')
    assert(typeof statistic.src_total_size === 'string')
    assert(typeof statistic.thumb_total_size === 'string')

    await prepareData({token, app, baseNum: 999})

    const new_statistic = await adminGetStatistic(token, app, 200)
    assert(new_statistic.available_photo_count > statistic.available_photo_count)
    assert(new_statistic.src_total_size !== statistic.src_total_size)
    assert(new_statistic.thumb_total_size !== statistic.thumb_total_size)
  })
})
