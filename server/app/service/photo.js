'use strict';

const fs = require('fs');
const imgSizeOf = require('image-size');
const getImageSize = filePath => new Promise((res, rej) => {
  imgSizeOf(filePath, (err, dimensions) => {
    err ? rej(err) : res(dimensions);
  });
});

const CommonService = require('./common');

module.exports = app =>
  class PhotoService extends CommonService {
    get OBJECT_NAME() {
      return '照片';
    }

    get Model() {
      return this.app.model.Photo;
    }

    async getImageDimensions(src) {
      const srcPath = app.serviceClasses.image.toLocalSrcPath(src);

      if (!fs.existsSync(srcPath)) {
        throw new this.app.WarningError('src不存在', 404);
      }

      const { width, height } = await getImageSize(srcPath);

      return { width, height };
    }

    async create(data) {
      return this.app.model.transaction(async transaction => {
        const { gallery_id, src } = data;

        await this.service.gallery.detectExistsById(gallery_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const { width, height } = await this.getImageDimensions(src);

        return await this.Model.create({
          gallery_id,
          author: data.author,
          desc: data.desc,
          src,
          width,
          height,
        }, { transaction });
      });
    }

    get editableProperty() {
      return [ 'gallery_id', 'author', 'desc', 'src' ];
    }

    async edit(id, data) {
      return this.app.model.transaction(async transaction => {
        const photo = await this.findById(id, { transaction, lock: transaction.LOCK.UPDATE });

        if (data.hasOwnProperty('gallery_id')) {
          // 检查相册是否存在
          await this.service.gallery.detectExistsById(data.gallery_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
        }

        this.editableProperty.forEach(key => {
          if (data.hasOwnProperty(key)) {
            photo[key] = data[key];
          }
        });

        if (data.src) {
          const { width, height } = await this.getImageDimensions(data.src);
          Object.assign(photo, { width, height });
        }

        return await photo.save({ transaction });
      });
    }

    getListByGalleryId({ gallery_id }) {
      return this.app.model.transaction(async transaction => {
        gallery_id = parseInt(gallery_id);

        await this.service.gallery.detectExistsById(gallery_id, { transaction, lock: transaction.LOCK.UPDATE });

        const list = await this.Model.findAll({
          where: {
            gallery_id,
          },

          transaction,
        });

        return list;
      });
    }

    getVoteOrderListByGalleryId({ gallery_id }) {
      return this.app.model.transaction(async transaction => {
        gallery_id = parseInt(gallery_id);

        await this.service.gallery.detectExistsById(gallery_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const list = await this.Model.findAll({
          where: {
            gallery_id,
          },

          order: [
            [ 'vote_count', 'DESC' ],
          ],

          transaction,
        });

        return list;
      });
    }

    removeById(id) {
      return this.app.model.transaction(async transaction => {
        return await this.destroyById(parseInt(id), { transaction });
      });
    }
  };
