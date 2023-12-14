const assert = require('assert');
const mock = require('egg-mock');
const {
  getToken,
  createGallery,
  createMember,
  createPhoto,
  getPhotoById,
  removePhotoById,
  createApp
} = require('./common');



describe('controller/admin/photo', () => {
  let app
  let token

  before(async () => {
    app = await createApp()
    token = await getToken(app)
  })

  it('admin create photo', async () => {
    const member = await createMember(token, app, { qq_num: 22222 })
    const gallery = await createGallery(token, app)
    await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })
  })

  
  let globalQqNum = 8000
  async function createRandomPhoto() {
    const member = await createMember(token, app, { qq_num: ++globalQqNum })
    const gallery = await createGallery(token, app)
    
    const newPhoto = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })

    const findPhoto = await getPhotoById(token, app, newPhoto.id, 200)
    assert(findPhoto.id === newPhoto.id)
  }

  it('admin get photo', async () => {
    await createRandomPhoto()
  })

  it('admin delete photo', async () => {
    const member = await createMember(token, app, { qq_num: 22224 })
    const gallery = await createGallery(token, app)
    const newPhoto = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })

    await removePhotoById(token, app, newPhoto.id, 200)
    await getPhotoById(token, app, newPhoto.id, 404)
  })
})
