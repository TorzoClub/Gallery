'use strict';

module.exports = app => {
  app.validator.addRule('qq_num', (rule, qq_num) => {
    if (!Number.isInteger(Number(qq_num))) {
      return '需要是整数格式';
    }
  });

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
