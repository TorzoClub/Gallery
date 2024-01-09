'use strict';

const { set: setEnvironmentSystem, reset: resetEnvironmentDate } = require('mockdate');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  uploadImage,
  commonCreateGallery,
  createMember,
  createPhoto,
  test_image_path,
  test_image_width,
  test_image_height,
  constructPlainEnvironment,
  test_avatar_image_path,
  constructEnvironment,
  submissionPhoto,
  default_upload_image_path,
  cancelMySubmission,
  removePhotoById,
  adminRefreshThumb,
  test_avatar_image_width,
  removeMemberById,
  removeGalleryById,
  getPhotoById,
  getMemberById,
} = require('./common');

describe('controller/admin/image', function () {
  this.slow(500);
  this.timeout(300000); // 5 min

  const pixel_rotated_image_path = `${__dirname}/static/temp.jpg`;
  const ori6_image_path = `${__dirname}/static/test-ori-6.jpg`

  before(async () => {
    await sharp(test_image_path).rotate(-90).toFile(pixel_rotated_image_path)
    // 创建 ori6_image_path 图像，以 pixel_rotated_image_path 为基础添加了 exif 信息
    await sharp(pixel_rotated_image_path)
      .withMetadata({ orientation: 6 }) // 1: 正; 6: 顺时针90deg; 8: 逆时针90deg; 3: 旋转180deg
      .toFile(ori6_image_path)
  })

  async function downloadImage(app, url_path) {
    const down_res = await app.httpRequest()
      .get(path.join(url_path))
      .expect('Content-Type', /image/)
      .expect(200)

    return down_res.body
  }

  async function loadMetadataByBuffer(buf) {
    const metadata = await sharp(buf).metadata()
    return metadata
  }

  async function loadImage(app, imagePath, src) {
    const buffer = await downloadImage(app, path.join(imagePath, src))
    return [await loadMetadataByBuffer(buffer), buffer]
  }

  it('should successfully upload image', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const img_meta = await sharp(test_image_path).metadata()
    assert(test_image_width, img_meta.width)
    assert(test_image_height, img_meta.height)
    await uploadImage(token, app, test_image_path)

    const backdata = await uploadImage(token, app, test_image_path)

    const [down_metadata] = await loadImage(
      app, backdata.imagePath, backdata.src
    )

    assert(down_metadata.width === test_image_width)
    assert(down_metadata.height === test_image_height)

    const down_thumb = await app.httpRequest()
      .get(path.join(backdata.imageThumbPath, backdata.thumb))
      .expect('Content-Type', /image/)
      .expect(200)
    const thumb_metadata = await sharp(down_thumb.body).metadata()
    assert(thumb_metadata.width === app.config.default_image_thumb_size)
  })

  it('should successfully convert thumb to next-generation fomat', async () => {
    const { app, token } = await constructPlainEnvironment(true)
    const { next_gen_formats } = app.config

    const { thumb, imageThumbPath } = await uploadImage(token, app, test_avatar_image_path)
    const [ default_thumb_meta ] = await loadImage(app, imageThumbPath, thumb)

    const thumb_name = path.parse(thumb).name
    for (const format of next_gen_formats) {
      const [downloaded_meta] = await loadImage(app, imageThumbPath, `${thumb_name}.${format}`)
      assert(downloaded_meta.width === default_thumb_meta.width)
      assert(downloaded_meta.height === default_thumb_meta.height)

      await loadImage(app, imageThumbPath, `${thumb_name}.jpg`)
    }
  })

  it('should successfully convert src to next-generation fomat', async () => {
    const { app, token } = await constructPlainEnvironment(true)
    const { next_gen_formats } = app.config

    const { src, imagePath } = await uploadImage(token, app, test_avatar_image_path)
    const [ default_src_meta ] = await loadImage(app, imagePath, src)

    const image_filename = path.parse(src).name
    for (const format of next_gen_formats) {
      const [downloaded_meta] = await loadImage(app, imagePath, `${image_filename}.${format}`)
      assert(downloaded_meta.width === default_src_meta.width)
      assert(downloaded_meta.height === default_src_meta.height)

      await loadImage(app, imagePath, `${image_filename}.jpg`)
    }
  })

  it('should thumb always is .jpg format', async () => {
    try {
      setEnvironmentSystem('2000/01/01 00:00:00')

      const { app, gallery, memberA } = await constructEnvironment({
        gallery: {
          event_start: new Date('1999'),
          submission_expire: new Date('2000/01/15'),
          event_end: new Date('2000/01/30')
        }
      })

      assert(/(.*)\.jpg/i.test(memberA.avatar_thumb))

      async function testFormat(format) {
        const image_path = path.join(
          path.parse(default_upload_image_path).dir,
          `${path.parse(default_upload_image_path).name}.${format}`
        )
        const qq_num = `${memberA.qq_num}`
        const submission_photo = await submissionPhoto(app, {
          gallery_id: `${gallery.id}`,
          qq_num,
          desc: 'description',
          image_path
        });

        await cancelMySubmission(app, { photo_id: submission_photo.id, qq_num, expect_code: 200 })
        assert( (new RegExp("(.*)\\." + format)).test(submission_photo.src) )
        // assert(/(.*)\.webp/i.test(submission_photo.src))
        assert(/(.*)\.jpg/i.test(submission_photo.thumb))
      }

      const { supported_formats } = app.config
      for (const [idx, format] of supported_formats.entries()) {
        setEnvironmentSystem(`2000/01/01 00:00:${`${idx + 1}`.padStart(2, '0')}`)
        await testFormat(format)
      }
    } finally {
      resetEnvironmentDate()
    }
  })

  it('should specify a custom dimension', async () => {
    const spec_width = 32
    const { app, token } = await constructPlainEnvironment(true)
    const { body: img } = await app.httpRequest()
      .post(`/admin/image/upload?thumb_size=${spec_width}`)
      .set('Authorization', token)
      .field('name', `image-${Date.now()}`)
      .attach('image', test_avatar_image_path)
      .expect(200);

    const [img_meta] = await loadImage(
      app, img.imageThumbPath, img.thumb
    )
    assert(img_meta.width !== app.config.default_image_thumb_size)
    assert(img_meta.width === spec_width)
  })

// 图片有两种旋转的方式
// 一种是位图层面的旋转，就是像素的重新排列
// 另一种就是不改动位图（像素重新排列）而只改动 EXIF 信息中的 Orientation 字段
// 毕竟是原图嘛，相册程序不会对用户上传的图片进行任何的处理，直接保存下来
// 但这样就会有个问题了：
// 第二种方式旋转过的图片，用 sharp 读取的时候不会得到正确的宽度和高度，而是没有改动的位图的宽高
// 这就需要处理了
  it('should correctly handle rotated image(rotate by exif Orientation)', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const ori6_backdata = await uploadImage(token, app, ori6_image_path)

    const member = await createMember(token, app, { qq_num: 22252 })
    const gallery = await commonCreateGallery(token, app, {})
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
      src: ori6_backdata.src,
    })

  // 测试图像显示起来就是宽度小于高度的图片
    assert(created_photo.width < created_photo.height)
  })

// 前面说的 exif 旋转的问题，
// 用 exif 旋转的图片所生成的缩略图也还是显示成没有旋转的样子
// 这也需要处理
// 因为缩略图需要经过重新压缩，所以直接从第二种旋转方式转为使用第一种旋转方式即可
  it('should correctly handle rotated thumb image(rotate by exif Orientation)', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const ori6_backdata = await uploadImage(token, app, ori6_image_path)

    const down_res = await app.httpRequest()
      .get(path.join(ori6_backdata.imageThumbPath, ori6_backdata.src))
      .expect('Content-Type', /image/)
      .expect(200)

    const { width, height } = await sharp(down_res.body).metadata()
    assert(typeof width === 'number')
    assert(typeof height === 'number')
  // 因为 ori6_image_path 显示起来就是宽度小于高度的图片，
  // 因此其缩略图也必定是宽度小于高度
    assert(width < height)
  })

  it('should successfully refresh thumb image', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const u_img = await uploadImage(token, app, test_avatar_image_path)

    const member = await createMember(token, app, { qq_num: 22122 })
    const gallery = await commonCreateGallery(token, app, {})
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
      src: u_img.src,
    })

    {
      const thumb_path = app.serviceClasses.image.toDefaultThumbSavePath(u_img.src)
      fs.unlinkSync(thumb_path)
      assert(fs.existsSync(thumb_path) === false)

      await app.httpRequest()
        .get(path.join(u_img.imageThumbPath, u_img.thumb))
        .expect(404)

      const res = await adminRefreshThumb(app, token, { src: u_img.src })
      assert(res.src_filename === u_img.src)
      assert(fs.existsSync(thumb_path) === true)

      const meta = await loadMetadataByBuffer(
        await downloadImage(app, created_photo.thumb_urlpath)
      )
      assert(meta.width === test_avatar_image_width)
    }
    {
      const res = await adminRefreshThumb(app, token, { src: u_img.src, thumb_size: 16 })
      const meta = await loadMetadataByBuffer(
        await downloadImage(app, created_photo.thumb_urlpath)
      )
      assert(meta.width === 16)
    }
  })

  it(`should correctly delete src when photo removed`, async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const member = await createMember(token, app, { qq_num: 22122 })
    const gallery = await commonCreateGallery(token, app, {})
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })

    {
      await removePhotoById(token, app, created_photo.id)

      const file_list = app.serviceClasses.image.allFilename(created_photo.src)
      for (const file of file_list) {
        await app.httpRequest().get(`/src/${file}`).expect(404)
        const exists = fs.existsSync(
          path.join(app.config.imageSavePath, file)
        )
        assert(false === exists)
      }
    }
  })

  it(`should correctly delete avatar_src when member removed`, async () => {
    const { app, token } = await constructPlainEnvironment(true)
    const member = await createMember(token, app, { qq_num: 22122 })

    {
      await removeMemberById(token, app, member.id)

      const file_list = app.serviceClasses.image.allFilename(member.avatar_src)
      for (const file of file_list) {
        await app.httpRequest().get(`/src/${file}`).expect(404)
        const exists = fs.existsSync(
          path.join(app.config.imageSavePath, file)
        )
        assert(false === exists)
      }
    }
  })

  it(`should correctly clean unused image`, async () => {
    const {
      app, token,
      memberA, memberB, memberC,
      authorA, authorB, authorC,
      photoA, photoB, photoC
    } = await constructEnvironment({ need_sync: true })

    const u_img_list = [
      await uploadImage(token, app),
      await uploadImage(token, app),
      await uploadImage(token, app),
      await uploadImage(token, app),
      await uploadImage(token, app),
    ]

    await app.runSchedule('clean-unused-image')

    {
      const file_list =
        u_img_list
          .map(u_img => app.serviceClasses.image.allFilename(u_img.src))
          .flat()

      for (const file of file_list) {
        await app.httpRequest().get(`/src/${file}`).expect(404)
        await app.httpRequest().get(`/thumb/${file}`).expect(404)

        const src_exists = fs.existsSync(
          path.join(app.config.imageSavePath, file)
        )
        assert(false === src_exists)

        const thumb_exists = fs.existsSync(
          path.join(app.config.imageThumbSavePath, file)
        )
        assert(false === thumb_exists)
      }
    }

    {
      const users = [memberA, memberB, memberC, authorA, authorB, authorC]
      const used_src_list = [
        ...users.map(m => m.avatar_src),
        ...[photoA, photoB, photoC].map(p => p.src)
      ]

      for (const file of used_src_list) {
        await app.httpRequest().get(`/src/${file}`).expect(200)
        const src_exists = fs.existsSync(
          path.join(app.config.imageSavePath, file)
        )
        assert(true === src_exists)

        for (const format of app.config.convert_formats) {
          const { name } = path.parse(file)
          const src = `${name}.${format}`
          await app.httpRequest().get(`/thumb/${src}`).expect(200)
          const thumb_exists = fs.existsSync(
            path.join(app.config.imageThumbSavePath, src)
          )
          assert(true === thumb_exists)
        }
      }
    }
  })
})
