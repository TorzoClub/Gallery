'use strict';

module.exports = app => {
  class MemberController extends app.Controller {
    async create(ctx) {
      const { body: data } = ctx.request;
      ctx.validate({
        name: { type: 'string', required: true },
        avatar_src: { type: 'string', required: true },
        qq_num: { type: 'qq_num', required: true },
      }, data);

      const result = await ctx.service.member.create({
        name: data.name,
        avatar_src: data.avatar_src,
        qq_num: data.qq_num,
      });

      ctx.backData(200, result);
    }

    async remove(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      ctx.backData(200, await ctx.service.member.removeById(id));
    }

    async get(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      ctx.backData(200, await ctx.service.member.findById(id));
    }

    async show(ctx) {
      const list = await ctx.model.Member.findAll();
      ctx.backData(200, list);
    }

    async edit(ctx) {
      const { id } = ctx.params;
      const { body: data } = ctx.request;

      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const validOption = {
        name: { type: 'string', required: false },
        avatar_src: { type: 'string', required: false },
        qq_num: { type: 'qq_num', required: false },
      };
      ctx.validate(validOption, data);

      ctx.backData(200, await ctx.service.member.edit(id, data));
    }

    async removeMemberGalleryVote(ctx) {
      const { id, gallery_id } = ctx.params;

      ctx.validate({
        id: { type: 'id', required: true },
        gallery_id: { type: 'id', required: true },
      }, ctx.params);

      ctx.backData(
        200,
        await ctx.service.member.removeMemberGalleryVote({
          member_id: id,
          gallery_id,
        })
      );
    }
  }

  return MemberController;
};
