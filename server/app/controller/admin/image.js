'use strict';

const sendToWormhole = require('stream-wormhole');
const path = require('path');

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
      const list = await ctx.app.model.Gallery.findAll({
        order: [
          [ 'index', 'DESC' ],
        ],
      });

      const photos_list = await Promise.all(
        list.map(gallery => {
          return gallery.getPhotos({
            order: [
              [ 'index', 'ASC' ],
            ],
          });
        })
      );

      ctx.backData(200, photos_list.flat());
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

    async refreshMemberThumb(ctx) {
      ctx.validate({
        member_id: { type: 'id', required: true },
      }, ctx.params);

      const member = await ctx.service.member.findById(ctx.params.member_id);

      await app.serviceClasses.image.removeThumb(member.avatar_thumb);
      const result = await app.serviceClasses.image.generateThumb(member.avatar_thumb);
      ctx.backData(200, result);
    }

    async refreshPhotoThumb(ctx) {
      ctx.validate({
        photo_id: { type: 'id', required: true },
      }, ctx.params);

      const photo = await ctx.service.photo.findById(ctx.params.photo_id);

      await app.serviceClasses.image.removeThumb(photo.thumb);
      const result = await app.serviceClasses.image.generateThumb(photo.thumb);
      ctx.backData(200, result);
    }
  }

  return ImageController;
};
