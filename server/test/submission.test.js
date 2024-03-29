const { set: setEnvironmentSystem, reset: resetEnvironmentDate } = require('mockdate');

const assert = require('assert');
const mock = require('egg-mock');
const {
  constructEnvironment,
  getPhotoById,
  removePhotoById,
  test_avatar_image_path,
  default_upload_image_path,
  test_avatar_image_width,
  test_avatar_image_height,
  default_upload_image_height,
  default_upload_image_width,
  submissionPhoto,
  editSubmissionPhoto,
  cancelMySubmission
} = require('./common');

async function findMyPhoto(app, {
  gallery_id,
  qq_num,
  expect_code = 200
}) {
  const { body } = await app.httpRequest()
    .get(`/gallery/${gallery_id}/submission/${qq_num}`)
    .expect(expect_code);

  return body
}
function updateGallery(app, token, expect_code, id, data) {
  return app.httpRequest()
    .patch(`/admin/gallery/${id}`)
    .set('Authorization', token)
    .type('json')
    .send({ ...data })
    .expect(expect_code)
}
async function preset(start, sub_exp, end) {
  const { app, gallery, memberA, token, ...remain_env } = await constructEnvironment({
    gallery: {
      event_start: new Date(start),
      submission_expire: new Date(sub_exp),
      event_end: new Date(end)
    }
  })

  const created_photo = await submissionPhoto(app, {
    gallery_id: `${gallery.id}`,
    qq_num: `${memberA.qq_num}`,
    desc: 'description',
  })

  return [created_photo, { app, gallery, memberA, token, ...remain_env }]
}

describe('find member submission by QQ Number', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  after(() => {
    resetEnvironmentDate()
  })

  it('should successfully find member submission', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    const created_photo = await submissionPhoto(app, {
      gallery_id: gallery.id,
      qq_num: memberA.qq_num,
      desc: 'description',
    })

    const photo = await findMyPhoto(app, {
      gallery_id: gallery.id,
      qq_num: memberA.qq_num
    })
    assert(typeof photo === 'object')
    assert(typeof photo !== null)
    assert(photo.id === created_photo.id)
  })

  it('should prevent find with non-existent gallery_id', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    await findMyPhoto(app, {
      gallery_id: '114514404',
      qq_num: memberA.qq_num,
      expect_code: 404
    })
  })

  it('should prevent find with non-existent qq_num', async () => {
    const { app, gallery } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    await findMyPhoto(app, {
      gallery_id: gallery.id,
      qq_num: '114514404404',
      expect_code: 404
    })
  })

  it('should correctly handle unsubmission', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    const photo = await findMyPhoto(app, {
      gallery_id: gallery.id,
      qq_num: memberA.qq_num,
      expect_code: 200
    })
    assert(photo === null)
  })
})

describe('member submission', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  after(() => {
    resetEnvironmentDate()
  })

  it('should successfully submission', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    const created_photo = await submissionPhoto(app, {
      gallery_id: gallery.id,
      qq_num: memberA.qq_num,
      desc: 'description',
    })

    assert(typeof created_photo === 'object')
    assert(created_photo.member_id === memberA.id)
    assert(created_photo.gallery_id === gallery.id)
    assert(created_photo.desc === 'description')
    assert(created_photo.width === 1)
    assert(created_photo.height === 1) // 上传的图片就是 1x1 的
  })

  it('should prevent submission out of the allowed period', async () => {
    {
      const { app, gallery, memberA } = await constructEnvironment({
        gallery: {
          event_start: new Date('1980'),
          submission_expire: new Date('1981'),
          event_end: new Date('1982')
        }
      })

      const edited = await submissionPhoto(app, {
        expect_code: 403,
        gallery_id: `${gallery.id}`,
        qq_num: `${memberA.qq_num}`,
        desc: 'description',
      })
    }
    {
      const { app, gallery, memberA } = await constructEnvironment({
        gallery: {
          event_start: new Date('1997'),
          submission_expire: new Date('1998'),
          event_end: new Date('1999')
        }
      })

      await submissionPhoto(app, {
        expect_code: 403,
        gallery_id: `${gallery.id}`,
        qq_num: `${memberA.qq_num}`,
        desc: 'description',
      })
    }
    {
      const { app, gallery, memberA } = await constructEnvironment({
        gallery: {
          event_start: new Date('1998'),
          submission_expire: new Date('1999'),
          event_end: new Date('2003')
        }
      })

      await submissionPhoto(app, {
        expect_code: 403,
        gallery_id: `${gallery.id}`,
        qq_num: `${memberA.qq_num}`,
        desc: 'description',
      })
    }
  })

  it('should prevent duplicate submissions', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    await submissionPhoto(app, {
      gallery_id: `${gallery.id}`,
      qq_num: `${memberA.qq_num}`,
      desc: 'description',
    })

    await submissionPhoto(app, {
      gallery_id: `${gallery.id}`,
      qq_num: `${memberA.qq_num}`,
      desc: 'description',
      expect_code: 409,
    })
  })

  it('should correctly handle concurrent submissions request', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    const ctx = app.mockContext()
    const created_file = await ctx.service.image.storeByFilePath(default_upload_image_path);

    const successes = []
    const failures = []
    // 并发创建1000次
    for (let i = 0; i < 1000; ++i) {
      try {
        const result = await ctx.service.photo.create({
          member_id: memberA.id,
          gallery_id: gallery.id,
          desc: 'test',
          src: created_file.src,
        })
        successes.push(result)
      } catch (err) {
        assert(err.status === 409)
        failures.push(err)
      }
    }

    assert(successes.length === 1)

    const photos = await ctx.service.photo.Model.findAll({
      where: {
        member_id: memberA.id,
        gallery_id: gallery.id,
      }
    })

    assert(photos.length === 1)
  })

  it('should prevent submission using non-existent QQ num', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    await submissionPhoto(app, {
      expect_code: 404,
      gallery_id: `${gallery.id}`,
      qq_num: `114514404`,
      desc: 'description',
    })
  })

  it('should prevent submission using incorrect data format', async () => {
    const { app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })
    await app.httpRequest()
      .post('/photo')
      // .field('gallery_id', gallery.id)
      .field('qq_num', memberA.qq_num)
      .field('desc', 'descaaa')
      .attach('image', test_avatar_image_path)
      .expect(400);

    await app.httpRequest()
      .post('/photo')
      .field('gallery_id', gallery.id)
      // .field('qq_num', memberA.qq_num)
      .field('desc', 'descaaa')
      .attach('image', test_avatar_image_path)
      .expect(400);

    await app.httpRequest()
      .post('/photo')
      .field('gallery_id', gallery.id)
      .field('qq_num', memberA.qq_num)
      // .field('desc', 'descaaa')
      .attach('image', test_avatar_image_path)
      .expect(400);

    await app.httpRequest()
      .post('/photo')
      .field('gallery_id', gallery.id)
      .field('qq_num', memberA.qq_num)
      .field('desc', 'descaaa')
      // .attach('image', test_avatar_image_path)
      .expect(400);
  })
})

describe('member edit submission', () => {
  function mockSystemTime() {
    setEnvironmentSystem('2000/01/01 00:00:00') // 设定时间为 2000/01/01
  }
  before(mockSystemTime)
  after(() => {
    resetEnvironmentDate()
  })

  it('should successfully edit submission', async () => {
    const { token, app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    const created_photo = await submissionPhoto(app, {
      gallery_id: `${gallery.id}`,
      qq_num: `${memberA.qq_num}`,
      desc: 'description',
    })

    setEnvironmentSystem('2000/01/01 00:00:01')

    const edited_photo = await editSubmissionPhoto(app, {
      photo_id: created_photo.id,
      image_path: test_avatar_image_path,
      qq_num: `${memberA.qq_num}`,
      desc: 'edited desc',
      expect_code: 200
    })

    setEnvironmentSystem('2000/01/01 00:00:02')

    assert(created_photo.id === edited_photo.id)

    {
      setEnvironmentSystem('2000/01/01 00:00:03')

      const photo = await getPhotoById(token, app, created_photo.id, 200)
      assert(photo.desc === 'edited desc')
      assert(photo.width === test_avatar_image_width)
      assert(photo.height === test_avatar_image_height)
    }
    {
      setEnvironmentSystem('2000/01/01 00:00:04')

      await editSubmissionPhoto(app, {
        photo_id: edited_photo.id,
        image_path: default_upload_image_path,
        qq_num: `${memberA.qq_num}`,
        desc: 'again_edit',
        expect_code: 200
      })
      const photo = await getPhotoById(token, app, edited_photo.id, 200)
      assert(photo.desc === 'again_edit')
      assert(photo.width === default_upload_image_width)
      assert(photo.height === default_upload_image_height)
    }
  })

  it('should prevent edit a non-existent photo', async () => {
    const [created_photo, { token, app, memberA }] = await preset('1999', '2000/01/15', '2000/01/30')

    await removePhotoById(token, app, created_photo.id, 200)

    await editSubmissionPhoto(app, {
      photo_id: created_photo.id,
      image_path: default_upload_image_path,
      qq_num: `${memberA.qq_num}`,
      desc: 'edited desc',
      expect_code: 404
    })
  })

  it('should prevent edit another author\'s photo', async () => {
    const [ , { app, memberA, photoA } ] = await preset('1990', '2005', '2020')
    await editSubmissionPhoto(app, {
      photo_id: photoA.id,
      image_path: default_upload_image_path,
      qq_num: `${memberA.qq_num}`,
      desc: 'edited desc',
      expect_code: 403
    })
  })

  it('should prevent edit when submission out of the allowed period', async () => {
    {
      const [ created_photo, { app, token, gallery, memberA } ] = await preset('1990', '2005', '2020')
      await updateGallery(app, token, 200, gallery.id, { submission_expire: new Date('1995') })
      await editSubmissionPhoto(app, {
        photo_id: created_photo.id,
        image_path: default_upload_image_path,
        qq_num: `${memberA.qq_num}`,
        desc: 'edited desc',
        expect_code: 403
      })
    }
    {
      const [ created_photo, { app, token, gallery, memberA } ] = await preset('1990', '2005', '2020')
      await updateGallery(app, token, 200, gallery.id, { submission_expire: new Date('1995'), event_end: new Date('1999') })
      await editSubmissionPhoto(app, {
        photo_id: created_photo.id,
        image_path: default_upload_image_path,
        qq_num: `${memberA.qq_num}`,
        desc: 'edited desc',
        expect_code: 403
      })
    }
    {
      const [ created_photo, { app, token, gallery, memberA } ] = await preset('1990', '2005', '2020')
      await updateGallery(app, token, 200, gallery.id, { event_start: new Date('2010'), submission_expire: new Date('2020'), event_end: new Date('2030') })
      await editSubmissionPhoto(app, {
        photo_id: created_photo.id,
        image_path: default_upload_image_path,
        qq_num: `${memberA.qq_num}`,
        desc: 'edited desc',
        expect_code: 403
      })
    }
  })

  it('should prevent edit using non-existent QQ num', async () => {
    const [ created_photo, { app } ] = await preset('1990', '2005', '2020')
    await editSubmissionPhoto(app, {
      photo_id: created_photo.id,
      image_path: default_upload_image_path,
      qq_num: `114514404404`,
      desc: 'edited desc',
      expect_code: 404
    })
  })

  it('should allow edit partial field', async () => {
    const [ created_photo, { token, app, memberA } ] = await preset('1990', '2005', '2020')
    const qq_num = memberA.qq_num

    setEnvironmentSystem('2000/01/01 00:01:00')

    const edited_photo = await app.httpRequest()
      .patch(`/photo/${created_photo.id}`)
      .field('qq_num', qq_num)
      // .field('desc', 'dddd')
      .attach('image', default_upload_image_path)
      .expect(200)
      .then(res => res.body);
    {
      const photo = await getPhotoById(token, app, created_photo.id)
      assert(photo.desc === created_photo.desc)
      assert(photo.id === created_photo.id)
      assert(photo.src !== created_photo.src)
      assert(photo.src === edited_photo.src)
      assert(photo.width === edited_photo.height)
      assert(photo.width === edited_photo.height)
    }

    setEnvironmentSystem('2000/01/01 00:02:00')

    await app.httpRequest()
      .patch(`/photo/${created_photo.id}`)
      .field('qq_num', qq_num)
      .field('desc', 'editeddddd')
      // .attach('image', default_upload_image_path)
      .expect(200);
    {
      const photo = await getPhotoById(token, app, created_photo.id)
      assert(photo.desc === 'editeddddd')
      assert(photo.id === created_photo.id)
      assert(photo.src === edited_photo.src)
    }

    mockSystemTime()
  })

  it('should prevent edit using incorrect data format', async () => {
    const [ created_photo, { app, memberA } ] = await preset('1990', '2005', '2020')
    await app.httpRequest()
      .patch(`/photo/${created_photo.id}`)
      .field('desc', 'dddd')
      .field('qq_num', 'qq_numincroeect')
      .attach('image', default_upload_image_path)
      .expect(400);
    await app.httpRequest()
      .patch(`/photo/i23n3cro2221`)
      .field('desc', 'dddd')
      .field('qq_num', `${memberA.qq_num}`)
      .attach('image', default_upload_image_path)
      .expect(400);
  })
})

describe('member request cancel submission', async () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  after(() => {
    resetEnvironmentDate()
  })
  it('should successfully cancel submission', async () => {
    const { token, app, gallery, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })
    const created_photo = await submissionPhoto(app, {
      gallery_id: `${gallery.id}`,
      qq_num: `${memberA.qq_num}`,
      desc: 'description',
    })

    await cancelMySubmission(app, {
      photo_id: created_photo.id,
      qq_num: `${memberA.qq_num}`,
      expect_code: 200,
    })

    await getPhotoById(token, app, created_photo.id, 404)
  })
  it('should prevent cancel another author\'s photo', async () => {
    const { token, app, gallery, memberA, authorB, photoB } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })
    assert(memberA.qq_num !== authorB.qq_num)

    await cancelMySubmission(app, {
      photo_id: photoB.id,
      qq_num: `${memberA.qq_num}`,
      expect_code: 403,
    })

    await submissionPhoto(app, {
      gallery_id: `${gallery.id}`,
      qq_num: `${memberA.qq_num}`,
      desc: 'description',
    })

    await cancelMySubmission(app, {
      photo_id: photoB.id,
      qq_num: `${memberA.qq_num}`,
      expect_code: 403,
    })
  })
  it('should prevent cancel a non-existent submission', async () => {
    const { token, app, gallery, memberA, authorB, photoB } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2000/01/15'),
        event_end: new Date('2000/01/30')
      }
    })

    await cancelMySubmission(app, {
      photo_id: '114514404404',
      qq_num: `${memberA.qq_num}`,
      expect_code: 404,
    })
  })
  it('should prevent cancel when submission out of the allowed period', async () => {
    {
      const [ created_photo, { app, token, gallery, memberA } ] = await preset('1990', '2005', '2020')
      await updateGallery(app, token, 200, gallery.id, { submission_expire: new Date('1995') })
      await cancelMySubmission(app, {
        photo_id: created_photo.id,
        qq_num: `${memberA.qq_num}`,
        expect_code: 403
      })
    }
    {
      const [ created_photo, { app, token, gallery, memberA } ] = await preset('1990', '2005', '2020')
      await updateGallery(app, token, 200, gallery.id, { submission_expire: new Date('1995'), event_end: new Date('1999') })
      await cancelMySubmission(app, {
        photo_id: created_photo.id,
        qq_num: `${memberA.qq_num}`,
        expect_code: 403
      })
    }
    {
      const [ created_photo, { app, token, gallery, memberA } ] = await preset('1990', '2005', '2020')
      await updateGallery(app, token, 200, gallery.id, { event_start: new Date('2010'), submission_expire: new Date('2020'), event_end: new Date('2030') })
      await cancelMySubmission(app, {
        photo_id: created_photo.id,
        qq_num: `${memberA.qq_num}`,
        expect_code: 403
      })
    }
  })
})
