'use strict';

const CommonService = require('./common');

module.exports = class GalleryService extends CommonService {
  get OBJECT_NAME() {
    return '相册';
  }

  get Model() {
    return this.app.model.Gallery;
  }

  create(data) {
    return this.Model.create({
      name: data.name,
      index: data.index,
      vote_expire: new Date(data.vote_expire),
      vote_limit: data.vote_limit,
    });
  }

  removeById(id) {
    return this.app.model.transaction(async transaction => {
      return this.Model.destroy({
        where: { id: parseInt(id) },
        transaction,
      });
    });
  }
};
