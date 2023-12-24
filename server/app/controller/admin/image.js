'use strict';

const sendToWormhole = require('stream-wormhole');

module.exports = app => {
  class ImageController extends app.Controller {
    async upload(ctx) {
      const stream = await ctx.getFileStream();
      try {
        const { imagePath, imageThumbPath, src, thumb } = await ctx.service.image.storeByStream(stream);
        ctx.backData(200, {
          imagePath,
          imageThumbPath,
          src,
          thumb,
          src_url: app.serviceClasses.image.toSrcUrl(src),
          thumb_url: app.serviceClasses.image.toThumbUrl(src),
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
