const assert = require('assert');
const mock = require('egg-mock');
const { getToken, getGalleryById, removeGalleryById, createApp, updateGalleryById } = require('./common');

describe('controller/admin/gallery', () => {
  let app
  let token

  before(async () => {
    app = await createApp()
    // app = mock.app();
    // // 等待 app 启动成功，才能执行测试用例
    // await app.ready()
    token = await getToken(app)
  })

  function getResData(res) {
    const data = res.body;
    return data;
  }

  const default_gallery_data = Object.freeze({
    name: 'gallery_name',
    index: 0,
    vote_limit: 3,
    event_start: new Date('2023'),
    submission_expire: new Date('2024'),
    event_end: new Date('2025'),
  })

  function createGalleryRequest(expect_code, data) {
    return app.httpRequest()
      .post('/admin/gallery')
      .set('Authorization', token)
      .type('json')
      .send({ ...data })
      .expect(expect_code)
  }

  it('creating gallery', async () => {
    await createGalleryRequest(200, default_gallery_data)
  })

  it('creating gallery with incorrect data format', async () => {
    const dup_data = { ...default_gallery_data }

    {
      const keys = Object.keys(dup_data)
      for (const key of keys) {
        const data = { ...dup_data }
        delete data[key]
        const res = await createGalleryRequest(400, data)
        assert(res.status === 400);
      }
    }

    {
      await createGalleryRequest(400, { ...dup_data, event_start: 'xx00' })
      await createGalleryRequest(400, { ...dup_data, submission_expire: 'xx00' })
      await createGalleryRequest(400, { ...dup_data, event_end: 'xx00' })
      await createGalleryRequest(400, { ...dup_data, vote_limit: -1 })
    }
    {
      await createGalleryRequest(400, { ...dup_data, event_start: 'xx00', submission_expire: 'xx00' })
      await createGalleryRequest(400, { ...dup_data, event_start: 'xx00', event_end: 'xx00' })
      await createGalleryRequest(400, { ...dup_data, submission_expire: 'xx00', event_end: 'xx00' })
    }
  })

  it('geting gallery', async () => {
    const created_res = await createGalleryRequest(200, default_gallery_data)
    const created = getResData(created_res)
    const gallery = await getGalleryById(token, app, created.id)

    assert(gallery.id === created.id)
    assert(gallery.name === created.name)
    assert(gallery.index === created.index)
    assert(gallery.event_start === created.event_start)
    assert(gallery.submission_expire === created.submission_expire)
    assert(gallery.event_end === created.event_end)
  })

  it('deleting gallery', async () => {
    const created_req = await createGalleryRequest(200, default_gallery_data)
    const created = getResData(created_req)
    const deleted = await removeGalleryById(token, app, created.id)
    assert(deleted.id === created.id)

    getGalleryById(token, app, deleted.id, 404)
  })

  it('getting gallery list', () => {
    return app.httpRequest()
      .get('/admin/gallery')
      .set('Authorization', token)
      .expect(200)
      .then(res => {
        const galleries = res.body
        assert(Array.isArray(galleries))
      })
  })

  it('updating gallery', async () => {
    const gallery_req = await createGalleryRequest(200, default_gallery_data)
    const created = getResData(gallery_req)
    await updateGalleryById(token, app, created.id, {
      name: 'edited name'
    })

    const edited = await getGalleryById(token, app, created.id)
    assert(edited.name === 'edited name')
  })

  it('updating non-existent gallery', async () => {
    await app.httpRequest()
      .patch(`/admin/gallery/404404404`)
      .set('Authorization', token)
      .type('json')
      .send({ name: 'test' })
      .expect(404)
  })

  it('updating gallery with incorrect data format', async () => {
    const gallery_req = await createGalleryRequest(200, default_gallery_data)
    const created = getResData(gallery_req)

    function update(expect_code, id, data) {
      return app.httpRequest()
        .patch(`/admin/gallery/${id}`)
        .set('Authorization', token)
        .type('json')
        .send({ ...data })
        .expect(expect_code)
    }
    await update(400, created.id, { name: 1 })
    await update(400, created.id, { index: '1' })
    await update(400, created.id, { vote_limit: '1' })
    await update(400, created.id, { vote_limit: -1 })
    await update(400, created.id, { event_start: 1 })
    await update(400, created.id, { submission_expire: 1 })
    await update(400, created.id, { event_end: 1 })

    await update(200, created.id, { id: 10000 }) // 无法修改 id
    await getGalleryById(token, app, created.id)
  })

  it('Event date Validation', async () => {
    function create(code, [ event_start, submission_expire, event_end ]) {
      return createGalleryRequest(code, {
        ...default_gallery_data,
        event_start: new Date(`${event_start}`),
        submission_expire: new Date(`${submission_expire}`),
        event_end: new Date(`${event_end}`),
      })
    }
    async function update(expect_code, data) {
      const gallery_req = await create(200, [2010, 2020, 2030])
      const created = getResData(gallery_req)

      await app.httpRequest()
        .patch(`/admin/gallery/${created.id}`)
        .set('Authorization', token)
        .type('json')
        .send({ ...data })
        .expect(expect_code)
    }

    // event_start、submission_expire、event_end 三个属性的关系
    // 永远是 event_start < submission_expire < event_end
    // 设定的值如果不能满足这个条件，则返回 http 400
    await create(200, [2010, 2020, 2030])

    await create(400, [2025, 2020, 2030])
    await create(400, [2040, 2020, 2030])

    await create(400, [2010, 1999, 2030])
    await create(400, [2010, 2040, 2030])

    await create(400, [2010, 2020, 1999])
    await create(400, [2010, 2020, 2015])

    await update(400, { event_start: new Date('2025') })
    await update(400, { event_start: new Date('2040') })

    await update(400, { submission_expire: new Date('1999') })
    await update(400, { submission_expire: new Date('2040') })

    await update(400, { event_end: new Date('1999') })
    await update(400, { event_end: new Date('2015') })
  })
});
