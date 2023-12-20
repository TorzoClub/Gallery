const assert = require('assert');
const mock = require('egg-mock');
const {
  getToken,
  commonCreateGallery,
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

  it('should successfully create a photo', async () => {
    const member = await createMember(token, app, { qq_num: 22222 })
    const gallery = await commonCreateGallery(token, app, {})
    await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })
  })

  it('should successfully create a photo with empty string desc', async () => {
    const member = await createMember(token, app, { qq_num: 22222 })
    const gallery = await commonCreateGallery(token, app, {})
    await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
      desc: '',
    })
  })

  it('should successfully get a photo infomation', async () => {
    let globalQqNum = 8000
    async function createRandomPhoto() {
      const member = await createMember(token, app, { qq_num: ++globalQqNum })
      const gallery = await commonCreateGallery(token, app, {})

      const newPhoto = await createPhoto(token, app, {
        gallery_id: gallery.id,
        member_id: member.id,
      })

      const findPhoto = await getPhotoById(token, app, newPhoto.id, 200)
      assert(findPhoto.id === newPhoto.id)
    }
    await createRandomPhoto()
  })

  it('should successfully delete a photo', async () => {
    const member = await createMember(token, app, { qq_num: 22224 })
    const gallery = await commonCreateGallery(token, app, {})
    const newPhoto = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })

    await removePhotoById(token, app, newPhoto.id, 200)
    await getPhotoById(token, app, newPhoto.id, 404)
  })
})
