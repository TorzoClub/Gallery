'use strict';

const sendToWormhole = require('stream-wormhole');

module.exports = app => {
  class ImageController extends app.Controller {
    async upload(ctx) {
      const stream = await ctx.getFileStream();
      try {
        const { imagePrefix, imageThumbPrefix, src, thumb } = await ctx.service.image.storeWithStream(stream);

        ctx.backData(200, {
          imagePrefix,
          imageThumbPrefix,
          src,
          thumb,
        });
      } catch (err) {
        await sendToWormhole(stream);
        throw err;
      }
    }
  }

  return ImageController;
};
