const assert = require('assert');
const mock = require('egg-mock');
const path = require('path')
const fileExists = require('../app/utils/file-exists');
const {
  getToken,
  commonCreateGallery,
  createMember,
  createPhoto,
  getPhotoById,
  removePhotoById,
  createApp,
  uploadImage,
  test_avatar_image_path,
  adminUpdatePhoto,
  default_upload_image_width,
  test_avatar_image_width
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
    const member = await createMember(token, app, { qq_num: 222202 })
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
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })

    const new_photo = await getPhotoById(token, app, created_photo.id, 200)

    await removePhotoById(token, app, new_photo.id, 200)
    await getPhotoById(token, app, new_photo.id, 404)
  })

  it('should successfully update a photo', async () => {
    const gallery = await commonCreateGallery(token, app, {})

    const member = await createMember(token, app, { qq_num: 2120 })
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })
    const old_photo = await getPhotoById(token, app, created_photo.id, 200)
    const photo_id = old_photo.id
    assert(old_photo.width === default_upload_image_width)

    {
      await adminUpdatePhoto(token, app, photo_id, {
        src: created_photo.src
      }, 200)
      const updated_photo = await getPhotoById(token, app, photo_id, 200)

      assert(updated_photo.width === default_upload_image_width)
      assert(updated_photo.src === created_photo.src)

      for (const format of app.config.convert_formats) {
        assert(
          await fileExists(
            path.join(
              app.config.imageSavePath,
              `${path.parse(created_photo.src).name}.${format}`
            )
          )
        )
      }
    }

    {
      const img = await uploadImage(token, app, test_avatar_image_path)
      await adminUpdatePhoto(token, app, photo_id, {
        src: img.src
      }, 200)

      const updated_photo = await getPhotoById(token, app, photo_id, 200)
      assert(updated_photo.width !== default_upload_image_width)
      assert(updated_photo.width === test_avatar_image_width)
      assert(updated_photo.src !== old_photo.src)

      const file_list = app.serviceClasses.image.allFilename(old_photo.src)
      for (const file of file_list) {
        const exists = await fileExists(path.join(app.config.imageSavePath, file))
        assert(exists === false)
      }
    }
  })
})
