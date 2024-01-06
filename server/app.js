'use strict';

const fs = require('fs');

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

  async checkDetectImagePoolPath() {
    const {
      env, imageThumbSavePath, imageSavePath,
    } = this.app.config;

    if (env === 'unittest') {
      if (!fs.existsSync(imageThumbSavePath)) {
        await fs.promises.mkdir(imageThumbSavePath, { recursive: true });
      }
      if (!fs.existsSync(imageSavePath)) {
        await fs.promises.mkdir(imageSavePath, { recursive: true });
      }
    } else {
      if (!fs.existsSync(imageThumbSavePath)) {
        throw Error('缩略图存放路径不存在！');
      }
      if (!fs.existsSync(imageSavePath)) {
        throw Error('原图存放路径不存在！');
      }
    }
  }

  async willReady() {
    const { app } = this;
    const { env } = app.config;

    if (env === 'local') {
      await app.model.sync({
        alter: true,
        force: false,
      });
    }

    await this.checkDetectImagePoolPath();

    app.validator.addRule('qq_num', (rule, qq_num) => {
      if (!Number.isInteger(Number(qq_num))) {
        return '需要是整数格式';
      }
    });
  }
}

module.exports = AppBootHook;
