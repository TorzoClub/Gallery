'use strict';

const CommonService = require('./common');

module.exports = class GalleryService extends CommonService {
  get OBJECT_NAME() {
    return '相册';
  }

  get Model() {
    return this.ctx.model.Gallery;
  }
};
