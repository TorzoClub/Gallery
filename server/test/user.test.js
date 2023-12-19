const { set: setEnvironmentSystem, reset: resetEnvironmentDate } = require('mockdate');

const assert = require('assert');
const mock = require('egg-mock');
const {
  getToken,
  commonCreateGallery,
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

async function constructEnvironment({
  need_sync = true,
  baseNum = 100,
  gallery: gallery_init = {},
}) {
  const app = mock.app()
  await app.ready();
  if (need_sync) {
    await app.model.sync({
      force: true,
    });
  }
  const token = await getToken(app)

  const gallery = await commonCreateGallery(token, app, gallery_init)

  const memberA = await createMember(token, app, { name: 'member-A', qq_num: baseNum + 1 })
  const memberB = await createMember(token, app, { name: 'member-B', qq_num: baseNum + 2 })
  const memberC = await createMember(token, app, { name: 'member-C', qq_num: baseNum + 3 })

  const authorA = await createMember(token, app, { name: 'author-A', qq_num: baseNum + 4 })
  const authorB = await createMember(token, app, { name: 'author-B', qq_num: baseNum + 5 })
  const authorC = await createMember(token, app, { name: 'author-C', qq_num: baseNum + 6 })

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

function checkEventPeriodMember(active) {
  assert(Array.isArray(active.photos))
  for (let photo of active.photos) {
    assert(photo.member === null)
    assert(photo.member_id === null)
  }
}

describe('getting Homepage infomation(not within event period)', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  after(() => {
    resetEnvironmentDate()
  })

  it('before event start date', async () => {
    const { app, gallery } = await constructEnvironment({
      gallery: {
        event_start: new Date('2010'),
        submission_expire: new Date('2011'),
        event_end: new Date('2012')
      }
    })
    const data = await getPhotoList(app)
    assert(data.active === null)
    assert(Array.isArray(data.galleries))
  })

  it('after event start date', async () => {
    const { app, gallery } = await constructEnvironment({
      gallery: {
        event_start: new Date('1990'),
        submission_expire: new Date('1991'),
        event_end: new Date('1992')
      }
    })
    const data = await getPhotoList(app)
    assert(data.active === null)
    assert(Array.isArray(data.galleries))
  })
})

describe('getting Homepage infomation(within event period)', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  beforeEach(() => {})
  after(() => {
    resetEnvironmentDate()
  })

  it('before submission_expire', async () => {
    const { app } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2001'),
        event_end: new Date('2002')
      }
    })
    const data = await getPhotoList(app)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(true === data.active.can_submission)
    assert(true === data.active.in_event)

    assert(Array.isArray(data.galleries))

    checkEventPeriodMember(data.active)
  })

  it('after submission_expire', async () => {
    const { app } = await constructEnvironment({
      gallery: {
        event_start: new Date('1998'),
        submission_expire: new Date('1999'),
        event_end: new Date('2001')
      }
    })
    const data = await getPhotoList(app)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(false === data.active.can_submission)
    assert(true === data.active.in_event)

    checkEventPeriodMember(data.active)
  })

  it('edit event end date', async () => {
    const { app, token, gallery } = await constructEnvironment({
      gallery: {
        event_start: new Date('1997'),
        submission_expire: new Date('1998'),
        event_end: new Date('2001')
      }
    })
    const data = await getPhotoList(app)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(false === data.active.can_submission)
    assert(true === data.active.in_event)

    await updateGalleryById(token, app, gallery.id, {
      event_end: new Date('1999')
    })
    const updated_data = await getPhotoList(app)
    assert(updated_data.active === null)
  })
})

describe('getting Homepage infomation by QQ(not within event period)', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  after(() => {
    resetEnvironmentDate()
  })

  it('before event start date', async () => {
    const { app, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('2010'),
        submission_expire: new Date('2011'),
        event_end: new Date('2012')
      }
    })
    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(data.active === null)
    assert(Array.isArray(data.galleries))
  })

  it('after event start date', async () => {
    const { app, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1990'),
        submission_expire: new Date('1991'),
        event_end: new Date('1992')
      }
    })
    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(data.active === null)
    assert(Array.isArray(data.galleries))
  })
})

describe('getting Homepage infomation by QQ(within event period)', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  beforeEach(() => {})
  after(() => {
    resetEnvironmentDate()
  })

  it('before submission_expire', async () => {
    const { app, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1999'),
        submission_expire: new Date('2001'),
        event_end: new Date('2002')
      }
    })
    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(true === data.active.can_submission)
    assert(true === data.active.in_event)

    checkEventPeriodMember(data.active)
  })

  it('after submission_expire', async () => {
    const { app, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1998'),
        submission_expire: new Date('1999'),
        event_end: new Date('2001')
      }
    })
    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(false === data.active.can_submission)
    assert(true === data.active.in_event)

    checkEventPeriodMember(data.active)
  })

  it('edit event end date', async () => {
    const { app, token, gallery, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1997'),
        submission_expire: new Date('1998'),
        event_end: new Date('2001')
      }
    })
    const data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(typeof data.active === 'object')
    assert(Array.isArray(data.galleries))

    assert(false === data.active.can_submission)
    assert(true === data.active.in_event)

    await updateGalleryById(token, app, gallery.id, {
      event_end: new Date('1999')
    })
    const updated_data = await fetchListWithQQNum(app, authorA.qq_num)
    assert(updated_data.active === null)
  })
})

describe('submit vote', () => {
  before(async () => {
    setEnvironmentSystem('2000/01/01') // 设定时间为 2000/01/01
  })
  beforeEach(() => {})
  after(() => {
    resetEnvironmentDate()
  })

  it('QQ login', async () => {
    const { app, memberA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1998'),
        submission_expire: new Date('1999'),
        event_end: new Date('2001')
      }
    })

    const notFoundResult = await confirmQQNum(app, 404404) // 不存在的号码
    assert(notFoundResult.value === false)

    const result = await confirmQQNum(app, memberA.qq_num, 200)
    assert(result.value === true)
  })

  it('memberA vote authorB', async () => {
    const { app, token, gallery, memberA, photoA, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1998'),
        submission_expire: new Date('1999'),
        event_end: new Date('2002')
      }
    })

    await submitVote(app, memberA.qq_num, gallery.id, [ photoA.id ])

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
    await submitVote(app, memberA.qq_num, gallery.id, [ photoA.id ], 409)
  })

  it('out of vote_limit', async () => {
    const { app, token, gallery, memberA, photoA, photoB, photoC, authorA } = await constructEnvironment({
      gallery: {
        vote_limit: 2,
        event_start: new Date('1998'),
        submission_expire: new Date('1999'),
        event_end: new Date('2003')
      }
    })

    assert(gallery.vote_limit === 2)

    await submitVote(
      app,
      memberA.qq_num,
      gallery.id,
      [ photoA.id, photoB.id, photoC.id ],
      403
    )
  })

  it('unlimited vote', async () => {
    const { app, token, gallery, memberA, photoA, photoB, photoC, authorA } = await constructEnvironment({
      gallery: {
        vote_limit: 0,
        event_start: new Date('1998'),
        submission_expire: new Date('1999'),
        event_end: new Date('2003')
      }
    })

    const authorD = await createMember(token, app, { name: 'author-D', qq_num: 5020 + 1 })
    const authorE = await createMember(token, app, { name: 'author-E', qq_num: 5020 + 2 })
    const authorF = await createMember(token, app, { name: 'author-F', qq_num: 5020 + 3 })
    const authorG = await createMember(token, app, { name: 'author-G', qq_num: 5020 + 4 })

    const photoD = await createPhoto(token, app, { member_id: authorD.id, gallery_id: gallery.id, desc: 'A' })
    const photoE = await createPhoto(token, app, { member_id: authorE.id, gallery_id: gallery.id, desc: 'A' })
    const photoF = await createPhoto(token, app, { member_id: authorF.id, gallery_id: gallery.id, desc: 'A' })
    const photoG = await createPhoto(token, app, { member_id: authorG.id, gallery_id: gallery.id, desc: 'A' })

    assert(gallery.vote_limit === 0)

    await submitVote(
      app,
      memberA.qq_num,
      gallery.id,
      [
        photoA,
        photoB,
        photoC,
        photoD,
        photoE,
        photoF,
        photoG,
      ].map(p => p.id),
      200
    )
  })

  it('vote another gallery\'s photo', async () => {
    const gallery_init = {
      vote_limit: 0,
      event_start: new Date('1998'),
      submission_expire: new Date('1999'),
      event_end: new Date('2003')
    }
    const { app, token, gallery, memberA, photoA, } = await constructEnvironment({ gallery: gallery_init })

    const anotherGallery = await commonCreateGallery(token, app, { gallery: gallery_init })

    const anotherAuthor = await createMember(token, app, { name: 'author-another', qq_num: 11422211 })
    const anotherPhoto = await createPhoto(token, app, { member_id: anotherAuthor.id, gallery_id: anotherGallery.id, desc: 'A' })

    await submitVote(app, memberA.qq_num, gallery.id, [ anotherPhoto.id ], 404)
  })

  it('cannot vote before submission_expire', async () => {
    const { app, token, gallery, memberA, photoA, authorA } = await constructEnvironment({
      gallery: {
        vote_limit: 1,
        event_start: new Date('1998'),
        submission_expire: new Date('2002'),
        event_end: new Date('2003')
      }
    })

    await submitVote(app, memberA.qq_num, gallery.id, [ photoA.id ], 403)
  })

  it('cannot vote before event start date', async () => {
    const { app, token, gallery, memberA, photoA, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('2010'),
        submission_expire: new Date('2011'),
        event_end: new Date('2022')
      }
    })

    await submitVote(app, memberA.qq_num, gallery.id, [ photoA.id ], 403)
  })

  it('cannot vote after event end date', async () => {
    const { app, token, gallery, memberA, photoA, authorA } = await constructEnvironment({
      gallery: {
        event_start: new Date('1980'),
        submission_expire: new Date('1981'),
        event_end: new Date('1982')
      }
    })

    await submitVote(app, memberA.qq_num, gallery.id, [ photoA.id ], 403)
  })
})
