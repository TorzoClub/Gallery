'use strict';

const assert = require('assert');
const mock = require('egg-mock');

module.exports = {
  createApp,
  getToken,
  uploadImage,

  createMember,
  getMemberById,
  removeMemberById,

  createGallery,
  getGalleryById,
  updateGalleryById,
  removeGalleryById,

  createPhoto,
  getPhotoById,
  removePhotoById,
};

let globalApp;
async function createApp(noSync) {
  // if (globalApp) {
  //   return globalApp;
  // }

  globalApp = mock.app();
  // 等待 app 启动成功，才能执行测试用例

  if (!noSync) {
    await globalApp.ready();
    await globalApp.model.sync({
      force: true,
    });
  }

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

async function uploadImage(token, app, imagePath = `${__dirname}/avatar.png`) {
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
  if (!appendmemberData.src) {
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

function createGallery(token, app) {
  return app.httpRequest()
    .post('/admin/gallery')
    .set('Authorization', token)
    .type('json')
    .send({
      name: 'gallery name',
      index: 0,
      vote_expire: new Date(),
      vote_limit: 3,
    })
    .expect(200)
    .then(res => {
      const gallery = res.body;
      assert(gallery.index === 0);
      assert(gallery.vote_limit === 3);
      assert(gallery.name === 'gallery name');
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

async function createPhoto(token, app, appendmemberData = {}) {
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
    .expect(200)
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
