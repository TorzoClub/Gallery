'use strict';

const fs = require('fs');
const imgSizeOf = require('image-size');
const getImageSize = filePath => new Promise((res, rej) => {
  imgSizeOf(filePath, (err, dimensions) => {
    err ? rej(err) : res(dimensions);
  });
});

const { Service } = require('egg');

module.exports = app =>
  class PhotoService extends Service {
    get Model() {
      return this.ctx.model.Photo;
    }

    get GalleryModel() {
      return this.ctx.model.Gallery;
    }

    get ImageService() {
      return this.ctx.service.image;
    }

    async getImageDimensions(src) {
      const srcPath = app.serviceClasses.image.toLocalSrcPath(src);

      if (!fs.existsSync(srcPath)) {
        throw new this.ctx.app.WarningError('src不存在', 404);
      }

      const { width, height } = await getImageSize(srcPath);

      return { width, height };
    }

    async create(data) {
      const { gallery_id, src } = data;
      const gallery = await this.GalleryModel.findByPk(gallery_id);

      if (!gallery) {
        throw new this.ctx.app.WarningError('相册不存在', 404);
      }

      const { width, height } = await this.getImageDimensions(src);

      return await this.Model.create({
        gallery_id,
        author: data.author,
        desc: data.desc,
        src,
        width,
        height,
      });
    }

    get editableProperty() {
      return [ 'gallery_id', 'author', 'desc', 'src' ];
    }

    async edit(id, data) {
      const photo = await this.Model.findByPk(id);

      if (!photo) {
        throw new this.ctx.app.WarningError('找不到该照片', 404);
      }

      if (data.hasOwnProperty('gallery_id')) {
        const gallery = await this.GalleryModel.findByPk(data.gallery_id);

        if (!gallery) {
          throw new this.ctx.app.WarningError('相册不存在', 404);
        }
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

      return await photo.save();
    }

    async getListByGalleryId({ gallery_id }) {
      gallery_id = parseInt(gallery_id);

      const gallery = await this.GalleryModel.findByPk(gallery_id);
      if (!gallery) {
        throw new this.ctx.app.WarningError('相册不存在', 404);
      }

      const list = await this.Model.findAll({
        include: [{
          model: this.ctx.model.Vote,
        }],

        where: {
          gallery_id,
        },
      });

      return list;
    }
  };
