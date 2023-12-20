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
      const photos_p = app.model.Photo.findAll();
      const members_p = app.model.Member.findAll();

      await ctx.service.image.removeAllThumbs();

      const src_list = [
        ...(await photos_p).map(p => p.src),
        ...(await members_p).map(m => m.avatar_src),
      ];

      await ctx.service.image.generateThumbs(src_list);

      ctx.backData(200, { });
    }
  }

  return ImageController;
};
