const assert = require('assert');
const mock = require('egg-mock');
const {
  getToken,
  createGallery,
  createMember,
  createPhoto,
  createApp,
  updateGalleryById
} = require('./common');

async function getPhotoList(app, expectStatusCode = 200) {
  return app.httpRequest()
    .get(`/photo`)
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function fetchListWithQQNum(app, qq_num, expectStatusCode = 200) {
  return app.httpRequest()
    .post(`/member/photo`)
    .type('json')
    .send({ qq_num })
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function confirmQQNum(app, qqNum, expectStatusCode = 200) {
  return app.httpRequest()
    .get(`/member/confirm/${qqNum}`)
    .expect(expectStatusCode)
    .then(res => res.body)
}

async function submitVote(app, qq_num, gallery_id, photo_id_list, expectStatusCode = 200) {
  return app.httpRequest()
    .post(`/member/vote`)
    .type('json')
    .send({ gallery_id, photo_id_list, qq_num })
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function constructEnvironment(noSync) {
  const app = await createApp(noSync)

  const token = await getToken(app)

  const gallery = await createGallery(token, app)

  const baseNum = Date.now()

  const memberA = await createMember(token, app, { name: 'member-A', qq_num: baseNum - 1 })
  const memberB = await createMember(token, app, { name: 'member-B', qq_num: baseNum - 2 })
  const memberC = await createMember(token, app, { name: 'member-C', qq_num: baseNum - 3 })

  const authorA = await createMember(token, app, { name: 'author-A', qq_num: baseNum - 4 })
  const authorB = await createMember(token, app, { name: 'author-B', qq_num: baseNum - 5 })
  const authorC = await createMember(token, app, { name: 'author-C', qq_num: baseNum - 6 })

  const photoA = await createPhoto(token, app, { member_id: authorA.id, gallery_id: gallery.id, desc: 'A' })
  const photoB = await createPhoto(token, app, { member_id: authorB.id, gallery_id: gallery.id, desc: 'B' })
  const photoC = await createPhoto(token, app, { member_id: authorC.id, gallery_id: gallery.id, desc: 'C' })

  return {
    app,
    token,
    gallery,
    authorA,
    authorB,
    authorC,
    memberA,
    memberB,
    memberC,
    photoA,
    photoB,
    photoC,
  }
}

describe('get Homepage infomation', () => {
  it('no activity', async () => {
    const { app } = await constructEnvironment()
    const data = await getPhotoList(app)
    assert(data.active === null)
    assert(Array.isArray(data.galleries))
  })

  it('has activity', async () => {
    const { gallery: expiredGallery } = await constructEnvironment()
    const { app, token, gallery: activeGallery } = await constructEnvironment(true)

    const d = new Date
    d.setDate(d.getDate() + 1)
    await updateGalleryById(token, app, activeGallery.id, {
      vote_expire: d.toISOString()
    })
    const data = await getPhotoList(app)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(data.active.id === activeGallery.id)
    assert(data.galleries[0].id === expiredGallery.id)
  })
})

describe('get Homepage infomation with qqnum log-in', () => {
  it('no activity', async () => {
    const { app, authorA } = await constructEnvironment(false)
    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(data.active === null)
    assert(Array.isArray(data.galleries))
  })

  it('has activity', async () => {
    const { gallery: expiredGallery } = await constructEnvironment()
    const { app, token, gallery: activeGallery, authorA } = await constructEnvironment(true)

    const d = new Date
    d.setDate(d.getDate() + 1)
    await updateGalleryById(token, app, activeGallery.id, {
      vote_expire: d.toISOString()
    })

    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(data.active.id === activeGallery.id)
    assert(data.galleries[0].id === expiredGallery.id)
  })
})

describe('submit vote', () => {
  it('confirmQQNum', async () => {
    const { app, memberA } = await constructEnvironment()

    const notFoundResult = await confirmQQNum(app, 404404) // 不存在的号码
    assert(notFoundResult.value === false)

    const result = await confirmQQNum(app, memberA.qq_num, 200)
    assert(result.value === true)
  })

  it('memberA vote authorB', async () => {
    const {
      app, token, gallery: activeGallery, memberA, photoA, authorA
    } = await constructEnvironment()

    const d = new Date
    d.setDate(d.getDate() + 1)
    await updateGalleryById(token, app, activeGallery.id, {
      vote_expire: d.toISOString()
    })

    await submitVote(app, memberA.qq_num, activeGallery.id, [ photoA.id ])

    const data = await fetchListWithQQNum(app, memberA.qq_num)
    data.active.photos.forEach((photo) => {
      if (photo.id === photoA.id) {
        assert(photo.is_voted === true)
        assert(photo.vote_count === 1)
        assert(photo.member === null)
        assert(photo.member_id === null)
      }
    })

    // 重复投票的情况
    await submitVote(app, memberA.qq_num, activeGallery.id, [ photoA.id ], 409)
  })
})
