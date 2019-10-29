'use strict';

module.exports = app => {
  class PhotoController extends app.Controller {
    async create(ctx) {
      const { body: data } = ctx.request;
      ctx.validate({
        gallery_id: { type: 'integer', required: true },
        author: { type: 'string', required: true },
        desc: { type: 'string', required: true },
        src: { type: 'string', required: true },
      }, data);

      const result = await ctx.service.photo.create({
        gallery_id: data.gallery_id,
        author: data.author,
        desc: data.desc,
        src: data.src,
      });

      ctx.backData(200, result);
    }

    async remove(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      const photo = await ctx.model.Photo.findByPk(id);
      if (photo) {
        ctx.backData(200, await photo.destroy());
      } else {
        throw new app.WarningError('照片不存在', 404);
      }
    }

    async show(ctx) {
      ctx.validate({
        gallery_id: { type: 'id', required: true },
      }, ctx.params);

      const list = await ctx.service.photo.getListByGalleryId({
        gallery_id: parseInt(ctx.params.gallery_id),
      });

      ctx.backData(200, list);
    }

    async showPhotoVote(ctx) {
      ctx.validate({
        gallery_id: { type: 'id', required: true },
      }, ctx.params);

      const list = await ctx.service.photo.getVoteOrderListByGalleryId({
        gallery_id: parseInt(ctx.params.gallery_id),
      });

      ctx.backData(200, list);
    }

    async edit(ctx) {
      const { id } = ctx.params;
      const { body: data } = ctx.request;

      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const validOption = {
        gallery_id: { type: 'integer', required: true },
        author: { type: 'string', required: true },
        desc: { type: 'string', required: true },
        src: { type: 'string', required: true },
      };
      ctx.validate(validOption, data);

      ctx.backData(200, await ctx.service.photo.edit(id, data));
    }
  }

  return PhotoController;
};
