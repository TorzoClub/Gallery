'use strict';

module.exports = app => {
  class PhotoController extends app.Controller {
    async create(ctx) {
      const { body: data } = ctx.request;
      ctx.validate({
        member_id: { type: 'integer', required: true },
        gallery_id: { type: 'integer', required: true },
        desc: { type: 'string', required: true },
        src: { type: 'string', required: true },
      }, data);

      const result = await ctx.service.photo.create({
        member_id: data.member_id,
        gallery_id: data.gallery_id,
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
      ctx.backData(200, await ctx.service.photo.removeById(id));
    }

    async get(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;

      const photo = await ctx.service.photo.findById(id);
      ctx.backData(200, {
        ...photo.toJSON(),
        member: await photo.getMember(),
      });
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

    async showMemberVote(ctx) {
      ctx.validate({
        gallery_id: { type: 'id', required: true },
      }, ctx.params);

      const list = await ctx.service.photo.getMemberVoteListByGalleryId({
        gallery_id: parseInt(ctx.params.gallery_id),
      });

      ctx.backData(200, list);
    }

    async sortByVoteCount(ctx) {
      ctx.validate({
        gallery_id: { type: 'id', required: true },
      }, ctx.params);

      const sortResult = await ctx.service.photo.sortByVoteCount({
        gallery_id: parseInt(ctx.params.gallery_id),
      });

      ctx.backData(200, sortResult);
    }

    async edit(ctx) {
      const { id } = ctx.params;
      const { body: data } = ctx.request;

      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const validOption = {
        member_id: { type: 'integer', required: false },
        gallery_id: { type: 'integer', required: false },
        desc: { type: 'string', required: false },
        src: { type: 'string', required: false },
      };
      ctx.validate(validOption, data);

      ctx.backData(200, await ctx.service.photo.edit(id, data));
    }
  }

  return PhotoController;
};
