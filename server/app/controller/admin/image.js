'use strict';

const sendToWormhole = require('stream-wormhole');

module.exports = app => {
  class ImageController extends app.Controller {
    thumbSize(width_raw) {
      const default_size = app.config.default_image_thumb_size;
      if (width_raw === undefined) {
        return default_size;
      } else {
        const width = Math.abs(Number(width_raw));
        if (Number.isNaN(width) || !Number.isInteger(width)) {
          throw new app.WarningError('指定的尺寸需要是有效的整数', 400);
        } else if (width > 9999) {
          throw new app.WarningError('指定的尺寸过大', 400);
        } else {
          return width;
        }
      }
    }

    async upload(ctx) {
      const stream = await ctx.getFileStream();
      const thumb_size = this.thumbSize(ctx.query.thumb_size);
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

    async refreshThumb(ctx) {
      const gallerys = await app.model.Gallery.findAll();
      const photos_list = await Promise.all(
        gallerys.map(gallery => {
          return gallery.getPhotos({
            order: [
              [ 'index', 'ASC' ],
            ],
          });
        })
      );

      const photos_list_flated = photos_list.flat();

      const members_p = app.model.Member.findAll();

      await ctx.service.image.removeAllThumbs();

      const src_list = [
        ...photos_list_flated.map(p => p.src),
        ...(await members_p).map(m => m.avatar_src),
      ];

      const [ successes, failures ] = await ctx.service.image.generateThumbs(src_list);

      ctx.backData(200, {
        successes,
        failures,
      });
    }
  }

  return ImageController;
};
