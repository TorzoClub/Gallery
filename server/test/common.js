'use strict';

const assert = require('assert');
const mock = require('egg-mock');

const default_upload_image_path = `${__dirname}/1x1.png`;
const test_avatar_image_path = `${__dirname}/avatar.png`;
const test_image_path = `${__dirname}/test.jpg`;
const test_image_width = 2970;
const test_image_height = 4200;

module.exports = {
  default_upload_image_path,
  default_upload_image_width: 1,
  default_upload_image_height: 1,
  test_avatar_image_path,
  test_avatar_image_width: 160,
  test_avatar_image_height: 160,

  test_image_path,
  test_image_width,
  test_image_height,

  createApp,
  getToken,
  constructPlainEnvironment,
  constructEnvironment,
  getHomePagePhotoList,
  fetchListWithQQNum,
  uploadImage,

  createMember,
  getMemberById,
  removeMemberById,

  commonCreateGallery,
  getGalleryById,
  updateGalleryById,
  removeGalleryById,

  createPhoto,
  getPhotoById,
  removePhotoById,

  editSubmissionPhoto,
  submissionPhoto,
  cancelMySubmission,
  adminRefreshThumb,
};

let globalApp;
async function createApp(noSync) {
  // if (globalApp) {
  //   return globalApp;
  // }

  const app = mock.app();
  // 等待 app 启动成功，才能执行测试用例

  if (!noSync) {
    await app.ready();
    await app.model.sync({
      force: true,
    });
  }

  globalApp = app;

  return globalApp;
}

function getToken(app) {
  return app.httpRequest()
    .post('/admin/login')
    .type('json')
    .send({
      pass: app.config.adminPass,
    })
    .expect(200)
    .then(res => {
      const { token } = res.body;
      return token;
    });
}
async function constructPlainEnvironment(need_sync = true) {
  const app = mock.app();
  await app.ready();
  if (need_sync) {
    await app.model.sync({
      force: true,
    });
  }
  const token = await getToken(app);
  return { app, token };
}
async function constructEnvironment({
  need_sync = true,
  baseNum = 100,
  gallery: gallery_init = {},
}) {
  const { app, token } = await constructPlainEnvironment(need_sync);

  const gallery = await commonCreateGallery(token, app, gallery_init);

  const memberA = await createMember(token, app, {
    name: 'member-A', qq_num: baseNum + 1,
  });
  const memberB = await createMember(token, app, {
    name: 'member-B', qq_num: baseNum + 2,
    avatar_src: memberA.avatar_src,
  });
  const memberC = await createMember(token, app, {
    name: 'member-C', qq_num: baseNum + 3,
    avatar_src: memberA.avatar_src,
  });

  const authorA = await createMember(token, app, {
    name: 'author-A', qq_num: baseNum + 4,
    avatar_src: memberA.avatar_src,
  });
  const authorB = await createMember(token, app, {
    name: 'author-B', qq_num: baseNum + 5,
    avatar_src: memberA.avatar_src,
  });
  const authorC = await createMember(token, app, {
    name: 'author-C', qq_num: baseNum + 6,
    avatar_src: memberA.avatar_src,
  });

  const photoA = await createPhoto(token, app, {
    member_id: authorA.id, gallery_id: gallery.id, desc: 'A',
    src: memberA.avatar_src,
  });
  const photoB = await createPhoto(token, app, {
    member_id: authorB.id,
    gallery_id: gallery.id,
    desc: 'B',
    src: memberA.avatar_src,
  });
  const photoC = await createPhoto(token, app, {
    member_id: authorC.id,
    gallery_id: gallery.id,
    desc: 'C',
    src: memberA.avatar_src,
  });

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
  };
}

async function getHomePagePhotoList(app, expectStatusCode = 200) {
  return app.httpRequest()
    .get('/photo')
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function fetchListWithQQNum(app, qq_num, expectStatusCode = 200) {
  return app.httpRequest()
    .post('/member/photo')
    .type('json')
    .send({ qq_num })
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function uploadImage(
  token,
  app,
  imagePath = default_upload_image_path
) {
  const { body: newImage } = await app.httpRequest()
    .post('/admin/image/upload')
    .set('Authorization', token)
    .field('name', `image-${Date.now()}`)
    .attach('image', imagePath)
    .expect(200);

  assert(typeof newImage.src === 'string');
  assert(typeof newImage.thumb === 'string');

  assert(typeof newImage.imagePath === 'string');
  assert(typeof newImage.imageThumbPath === 'string');

  return newImage;
}

async function createMember(token, app, appendmemberData = {}) {
  if (!appendmemberData.avatar_src) {
    const uploadedImage = await uploadImage(token, app);
    appendmemberData.avatar_src = uploadedImage.src;
  }
  const data = {
    name: 'member name',
    qq_num: 114514,
    ...appendmemberData,
  };

  return app.httpRequest()
    .post('/admin/member')
    .set('Authorization', token)
    .type('json')
    .send(data)
    .expect(200)
    .then(res => {
      const member = res.body;
      assert(member.avatar_src === data.avatar_src);
      return member;
    });
}

function getMemberById(token, app, id, expectStatusCode = 200) {
  return app.httpRequest()
    .get(`/admin/member/${id}`)
    .set('Authorization', token)
    .expect(expectStatusCode)
    .then(res => res.body);
}

function removeMemberById(token, app, id) {
  return app.httpRequest()
    .delete(`/admin/member/${id}`)
    .set('Authorization', token)
    .expect(200)
    .then(res => res.body);
}

function commonCreateGallery(token, app, append_data = {}) {
  const send_data = {
    name: 'gallery_name',
    index: 0,
    vote_limit: 3,
    event_start: new Date('2023'),
    submission_expire: new Date('2024'),
    event_end: new Date('2025'),
    ...append_data,
  };
  return app.httpRequest()
    .post('/admin/gallery')
    .set('Authorization', token)
    .type('json')
    .send(send_data)
    .expect(200)
    .then(res => {
      const gallery = res.body;
      return gallery;
    });
}
function getGalleryById(token, app, id, expectStatusCode = 200) {
  return app.httpRequest()
    .get(`/admin/gallery/${id}`)
    .set('Authorization', token)
    .expect(expectStatusCode)
    .then(res => {
      const gallery = res.body;
      return gallery;
    });
}
function updateGalleryById(token, app, id, updateData = {}) {
  return app.httpRequest()
    .patch(`/admin/gallery/${id}`)
    .set('Authorization', token)
    .type('json')
    .send({
      ...updateData,
    })
    .expect(200)
    .then(res => res.body);
}

function removeGalleryById(token, app, id) {
  return app.httpRequest()
    .delete(`/admin/gallery/${id}`)
    .set('Authorization', token)
    .expect(200)
    .then(res => {
      const gallery = res.body;
      return gallery;
    });
}

async function createPhoto(token, app, appendmemberData = {}, expect_code = 200) {
  if (!appendmemberData.src) {
    const uploadedImage = await uploadImage(token, app);
    appendmemberData.src = uploadedImage.src;
  }
  const data = {
    member_id: -1,
    gallery_id: -1,
    desc: 'desc',
    // src: uploadedImage.src,
    ...appendmemberData,
  };

  return app.httpRequest()
    .post('/admin/photo')
    .set('Authorization', token)
    .type('json')
    .send(data)
    .expect(expect_code)
    .then(res => {
      const photo = res.body;
      assert(photo.src === data.src);
      return photo;
    });
}

async function getPhotoById(token, app, photoId, expectStatusCode = 200) {
  return app.httpRequest()
    .get(`/admin/photo/${photoId}`)
    .set('Authorization', token)
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function removePhotoById(token, app, photoId, expectStatusCode = 200) {
  return app.httpRequest()
    .delete(`/admin/photo/${photoId}`)
    .set('Authorization', token)
    .expect(expectStatusCode)
    .then(res => res.body);
}

async function editSubmissionPhoto(app, {
  photo_id,
  qq_num,
  desc,
  image_path = default_upload_image_path,
  expect_code = 200,
}) {
  const { body } = await app.httpRequest()
    .patch(`/photo/${photo_id}`)
    .field('desc', desc)
    .field('qq_num', `${qq_num}`)
    .attach('image', image_path)
    .expect(expect_code);

  return body;
}

async function submissionPhoto(app, {
  gallery_id,
  qq_num,
  desc,
  image_path = default_upload_image_path,
  expect_code = 200,
}) {
  const { body } = await app.httpRequest()
    .post('/photo')
    .field('name', `image-${Date.now()}`)
    .field('gallery_id', `${gallery_id}`)
    .field('qq_num', `${qq_num}`)
    .field('desc', desc)
    .attach('image', image_path)
    .expect(expect_code);

  return body;
}
async function cancelMySubmission(app, {
  photo_id,
  qq_num,
  expect_code = 200,
}) {
  const { body } = await app.httpRequest()
    .delete(`/photo/${photo_id}?qq_num=${qq_num}`)
    .expect(expect_code);

  return body;
}

async function adminRefreshThumb(app, token, {
  src, thumb_size,
}) {
  const res = await app.httpRequest()
    .post('/admin/image/refresh-thumb')
    .set('Authorization', token)
    .type('json')
    .send({ src, thumb_size })
    .expect(200);

  return res.body;
}
