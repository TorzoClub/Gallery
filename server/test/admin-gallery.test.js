const assert = require('assert');
const mock = require('egg-mock');
const { getToken,   createGallery, getGalleryById, removeGalleryById, createApp, updateGalleryById } = require('./common');



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

  it('admin create gallery', () => {
    return createGallery(token, app)
  })

  it('admin get gallery', async () => {
    const createdGallery = await createGallery(token, app)
    const gallery = await getGalleryById(token, app, createdGallery.id)

    assert(gallery.id === createdGallery.id)
    assert(gallery.is_expired === createdGallery.is_expired)
    assert(gallery.name === createdGallery.name)
    assert(gallery.index === createdGallery.index)
    assert(gallery.vote_limit === createdGallery.vote_limit)
  })

  it('admin delete gallery', async () => {
    const createdGallery = await createGallery(token, app)
    const deletedGallery = await removeGalleryById(token, app, createdGallery.id)
    assert(deletedGallery.id === createdGallery.id)

    getGalleryById(token, app, deletedGallery.id, 404)
  })

  it('admin show gallery', () => {
    return app.httpRequest()
      .get('/admin/gallery')
      .set('Authorization', token)
      .expect(200)
      .then(res => {
        const galleries = res.body
        assert(Array.isArray(galleries))
      })
  })

  it('admin update gallery', async () => {
    const gallery = await createGallery(token, app)
    await updateGalleryById(token, app, gallery.id, {
      name: 'edited name'
    })

    const findGallery = await getGalleryById(token, app, gallery.id)
    assert(findGallery.name === 'edited name')
  })
});
