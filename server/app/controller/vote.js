'use strict';

module.exports = app => {
  class VoteController extends app.Controller {
    async create(ctx) {
      const { body: data } = ctx.request;
      ctx.validate({
        gallery_id: { type: 'integer', required: true },
        photo_id: { type: 'integer', required: true },
        qq_num: { type: 'integer', required: true },
      }, data);

      const result = await ctx.service.vote.create({
        gallery_id: data.gallery_id,
        photo_id: data.photo_id,
        qq_num: data.qq_num,
      });

      ctx.backData(200, result);
    }
  }

  return VoteController;
};
