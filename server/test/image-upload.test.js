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
} = require('./common');


describe('controller/admin/image', () => {
  const pixel_rotated_image_path = `${__dirname}/static/temp.jpg`;
  const ori6_image_path = `${__dirname}/static/test-ori-6.jpg`

  before(async () => {
    await sharp(test_image_path).rotate(-90).toFile(pixel_rotated_image_path)
    // 创建 ori6_image_path 图像，以 pixel_rotated_image_path 为基础添加了 exif 信息
    await sharp(pixel_rotated_image_path)
      .withMetadata({ orientation: 6 }) // 1: 正; 6: 顺时针90deg; 8: 逆时针90deg; 3: 旋转180deg
      .toFile(ori6_image_path)
  })

  async function downloadImage(app, imagePath, src) {
    const down_res = await app.httpRequest()
      .get(path.join(imagePath, src))
      .expect('Content-Type', /image/)
      .expect(200)

    return down_res.body
  }

  async function loadMetadataByBuffer(buf) {
    const metadata = await sharp(buf).metadata()
    return metadata
  }

  async function loadImage(app, imagePath, src) {
    const buffer = await downloadImage(app, imagePath, src)
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

  const __SUPPORTED_FORMATS__ = ['webp', 'avif']

  it('should successfully convert thumb to webp/avif fomat', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const { thumb, imageThumbPath } = await uploadImage(token, app, test_avatar_image_path)
    const [ default_thumb_meta ] = await loadImage(app, imageThumbPath, thumb)

    const thumb_name = path.parse(thumb).name
    for (const format of __SUPPORTED_FORMATS__) {
      const [downloaded_meta] = await loadImage(app, imageThumbPath, `${thumb_name}.${format}`)
      assert(downloaded_meta.width === default_thumb_meta.width)
      assert(downloaded_meta.height === default_thumb_meta.height)

      await loadImage(app, imageThumbPath, `${thumb_name}.jpg`)
    }
  })

  it('should successfully convert src to webp/avif fomat', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const { src, imagePath } = await uploadImage(token, app, test_avatar_image_path)
    const [ default_src_meta ] = await loadImage(app, imagePath, src)

    const image_filename = path.parse(src).name
    for (const format of __SUPPORTED_FORMATS__) {
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

      setEnvironmentSystem('2000/01/01 00:00:01')
      await testFormat('webp')

      setEnvironmentSystem('2000/01/01 00:00:02')
      await testFormat('avif')

      setEnvironmentSystem('2000/01/01 00:00:03')
      await testFormat('jpeg')

      setEnvironmentSystem('2000/01/01 00:00:04')
      await testFormat('jpg')
    } finally {
      resetEnvironmentDate()
    }
  })

  it('should specify a custom dimension', async () => {
    const spec_width = 32
    const { app, token } = await constructPlainEnvironment(true)
    const { body: img } = await app.httpRequest()
      .post(`/admin/image/upload?width=${spec_width}`)
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
    assert(width < height) // 因为 ori6_image_path 显示起来就是宽度小于高度的图片，因此其缩略图也必定是宽度小于高度
  })

  it('should successfully refresh thumb image', async () => {
    const { app, token } = await constructPlainEnvironment(true)

    const u_img = await uploadImage(token, app)

    const thumb_path = app.serviceClasses.image.toDefaultThumbSavePath(u_img.src)

    fs.unlinkSync(thumb_path)

    assert(fs.existsSync(thumb_path) === false)

    await app.httpRequest()
      .get(path.join(u_img.imageThumbPath, u_img.thumb))
      .expect(404)

    const member = await createMember(token, app, { qq_num: 22122 })
    const gallery = await commonCreateGallery(token, app, {})
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
      src: u_img.src,
    })

    const res = await app.httpRequest()
      .get('/admin/image/refresh-thumb')
      .set('Authorization', token)
      .expect(200)

    const { successes, failures } = res.body

    assert(Array.isArray(successes))
    assert(successes.length === 2) // 创建了一张照片和一位用户的头像
    assert(Array.isArray(failures))
    assert(failures.length === 0)
    assert(fs.existsSync(thumb_path) === true)

    {
      fs.unlinkSync(path.join(app.config.imageSavePath, created_photo.src))
      const res = await app.httpRequest()
        .get('/admin/image/refresh-thumb')
        .set('Authorization', token)
        .expect(200)

      const { successes, failures } = res.body
      assert(successes.length === 1)
      assert(failures.length === 1)
    }
  })

  // it('check unuse image after refresh thumb', async () => {
  //   const unuse_img = await uploadImage(token, app, test_image_path)
  //   const img = await uploadImage(token, app, test_image_path)
  //   const member = await createMember(token, app, { qq_num: 22222 })
  //   const gallery = await commonCreateGallery(token, app, {})
  //   const created_photo = await createPhoto(token, app, {
  //     gallery_id: gallery.id,
  //     member_id: member.id,
  //     src: img.src,
  //   })

  //   const unuse_img_path = app.serviceClasses.image.toSrcSavePath(unuse_img.src)
  //   assert(fs.existsSync(unuse_img_path) === true)

  //   await app.httpRequest()
  //     .get('/admin/image/refresh-thumb')
  //     .set('Authorization', token)
  //     .expect(200)

  //   assert(fs.existsSync(unuse_img_path) === false)
  // })
})
