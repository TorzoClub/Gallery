'use strict';

module.exports = app => {
  class MemberController extends app.Controller {
    async confirm(ctx) {
      ctx.validate({
        qq_num: { type: 'qq_num', required: true },
      }, ctx.params);

      const qq_num = Number(ctx.params.qq_num);
      const member = await ctx.service.member.Model.findOne({
        where: { qq_num },
      });

      ctx.backData(200, { value: Boolean(member) });
    }
  }

  return MemberController;
};
