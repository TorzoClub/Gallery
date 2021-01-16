'use strict';

module.exports = app => {
  class AuthController extends app.Controller {
    async login(ctx) {
      const configPass = app.config.adminPass;
      const { pass } = ctx.request.body;

      if (configPass !== pass) {
        return ctx.backData(403, Error('密码错误'));
      }

      const token = app.jwt.sign({ permission: 'admin' }, app.config.jwt.secret, {
        expiresIn: app.config.jwt.expiresIn,
      });
      ctx.backData(200, { token });
    }

    test(ctx) {
      ctx.backData(200, 'hello');
    }
  }

  return AuthController;
};
