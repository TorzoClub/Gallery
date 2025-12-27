'use strict';

const sendToWormhole = require('stream-wormhole');
const path = require('path');
const fs = require('fs');

module.exports = app => {
  class ImageController extends app.Controller {
    checkThumbSize(size_raw) {
      const default_size = app.config.default_image_thumb_size;
      if (size_raw === undefined) {
        return default_size;
      } else {
        const size = Math.abs(Number(size_raw));
        if (Number.isNaN(size) || !Number.isInteger(size)) {
          throw new app.WarningError('指定的尺寸需要是有效的整数', 400);
        } else if (size > 9999) {
          throw new app.WarningError('指定的尺寸过大', 400);
        } else {
          return size;
        }
      }
    }

    async upload(ctx) {
      const stream = await ctx.getFileStream();
      const thumb_size = this.checkThumbSize(ctx.query.thumb_size);
      try {
        const {
          imagePath, imageThumbPath, src, thumb,
        } = await ctx.service.image.storeByStream(stream, thumb_size);
        ctx.backData(200, {
          imagePath,
          imageThumbPath,
          src,
          thumb,
          src_url: app.serviceClasses.image.toSrcUrl(src),
          thumb_url: app.serviceClasses.image.toDefaultThumbUrl(src),
        });
      } catch (err) {
        await sendToWormhole(stream);
        throw err;
      }
    }

    async getAllAvailablePhoto(ctx) {
      ctx.backData(
        200,
        await ctx.service.photo.getAvailablePhotoList()
      );
    }

    async refreshThumb(ctx) {
      ctx.validate({
        src: { type: 'string', required: true },
        thumb_size: { type: 'integer', required: false },
      }, ctx.request.body);
      const { src, thumb_size } = ctx.request.body;

      const { name, ext } = path.parse(src);

      const result = await app.serviceClasses.image.generateThumb(
        `${name}${ext}`,
        { thumb_size: this.checkThumbSize(thumb_size) }
      );

      ctx.backData(200, result);
    }

    async cleanUnusedImage(ctx) {
      const [ available_photo_list, member_list ] = await Promise.all([
        ctx.service.photo.getAvailablePhotoList(),
        ctx.model.Member.findAll({}),
      ]);

      const used_src_list = [
        ...available_photo_list.map(p => p.src),
        ...member_list.map(m => m.avatar_src),
      ].map(f => path.parse(f).name);

      const { imageSavePath, imageThumbSavePath } = ctx.app.config;

      const file_list = [
        ...fs.readdirSync(imageSavePath).map(f => path.join(imageSavePath, f)),
        ...fs.readdirSync(imageThumbSavePath).map(f => path.join(imageThumbSavePath, f)),
      ];

      const clean_list = [];

      for (const file of file_list) {
        const { name: file_name } = path.parse(file);
        const is_used = used_src_list.includes(file_name);
        if (!is_used) {
          if (fs.lstatSync(file).isFile()) {
            fs.unlinkSync(file);
            ctx.app.logger.info(`auto clean used image: ${file}`);
            clean_list.push(file);
          }
        }
      }

      ctx.backData(200, clean_list);
    }
  }

  return ImageController;
};
