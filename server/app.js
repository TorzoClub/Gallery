'use strict';

class WarningError extends Error {
  constructor(message, status) {
    super(...arguments);

    Object.assign(this, { status });
  }
}

class AppBootHook {
  constructor(app) {
    this.app = app;

    Object.assign(app, {
      WarningError,
    });
  }

  async willReady() {
    const { app } = this;
    const { env, startBeforeGenerateThumb } = app.config;

    if (env === 'local') {
      await app.model.sync({
        alter: true,
        force: false,
      });
    }

    if (startBeforeGenerateThumb) {
      await this.startBeforeGenerateThumb();
    }
  }

  async startBeforeGenerateThumb() {
    const { app } = this;

    const photos = await app.model.Photo.findAll();
    const users = await app.model.Member.findAll();
    const srcList = [
      ...users.map(user => user.dataValues.avatar_src),
      ...photos.map(photo => photo.dataValues.src),
    ];

    for (let i = 0; i < srcList.length; ++i) {
      const src = srcList[i];

      const localFilePath = app.serviceClasses.image.toLocalSrcPath(src);
      console.log(`(${i + 1}/${srcList.length})刷新缩略图: ${localFilePath}`);
      await app.serviceClasses.image.generateThumb(localFilePath);
    }
  }
}

module.exports = AppBootHook;
