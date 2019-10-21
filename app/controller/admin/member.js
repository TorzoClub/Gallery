'use strict';

module.exports = app => {
  class MemberController extends app.Controller {
    async create(ctx) {
      const { body: data } = ctx.request;
      ctx.validate({
        name: { type: 'string', required: true },
        qq_num: { type: 'integer', required: true },
      }, data);

      const result = await ctx.service.member.create({
        name: data.name,
        qq_num: data.qq_num,
      });

      ctx.backData(200, result);
    }

    async remove(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      const member = await ctx.model.Member.findByPk(id);
      if (member) {
        ctx.backData(200, await member.destroy());
      } else {
        throw new app.WarningError('成员不存在', 404);
      }
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
        qq_num: { type: 'integer', required: false },
      };
      ctx.validate(validOption, data);

      ctx.backData(200, await ctx.service.member.edit(id, data));
    }
  }

  return MemberController;
};
