const assert = require('assert');
const {
  constructEnvironment, adminGetStatistic, prepareData, uploadImage,
  test_avatar_image_path, adminCleanImage
} = require('./common')

describe('Dashboard Home statistic', () => {
  it('should shuccessfully get Dashboard Home statistic', async () => {
    const { app, token } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2001'),
        event_end: new Date('2002')
      }
    })

    await adminCleanImage(token, app)

    {
      const statistic = await adminGetStatistic(token, app, 200)

      await uploadImage(token, app, test_avatar_image_path)

      const new_statistic = await adminGetStatistic(token, app, 200)

      assert(new_statistic.available_photo_count === statistic.available_photo_count)
      assert(new_statistic.src_storage !== statistic.src_storage)
      assert(new_statistic.thumb_storage !== statistic.thumb_storage)

      await adminCleanImage(token, app)

      const clean_after_statistic = await adminGetStatistic(token, app, 200)

      assert(clean_after_statistic.available_photo_count === new_statistic.available_photo_count)
      assert(clean_after_statistic.src_storage !== new_statistic.src_storage)
      assert(clean_after_statistic.thumb_storage !== new_statistic.thumb_storage)
    }

    {
      const statistic = await adminGetStatistic(token, app, 200)
      assert(typeof statistic === 'object')
      assert(typeof statistic.available_photo_count === 'number')
      assert(typeof statistic.src_storage === 'string')
      assert(typeof statistic.thumb_storage === 'string')

      await prepareData({token, app, baseNum: 999})
      await prepareData({token, app, baseNum: 9999})
      await prepareData({token, app, baseNum: 99999})

      const new_statistic = await adminGetStatistic(token, app, 200)
      assert(new_statistic.available_photo_count > statistic.available_photo_count)
    }
  })
})
