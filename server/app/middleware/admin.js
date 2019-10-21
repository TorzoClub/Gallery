'use strict';

module.exports = (ctx, next) => {
  const { app } = ctx;

  const token = ctx.header.authorization;

  if (!token) {
    ctx.status = 401;
    ctx.body = {
      message: '权限不足',
    };
    return;
  }

  try {
    const verifyResult = app.jwt.verify(token);

    if (verifyResult.permission !== 'admin') {
      // permission failure
      ctx.backData(403, {
        message: '你没有足够的权限这么做',
      });
    } else {
      return next();
    }
  } catch (err) {
    // token failure
    if (err.name === 'TokenExpiredError') {
      return ctx.backData(401, {
        EXPIRED_TOKEN: true,
        message: 'token 过期',
      });
    }

    console.error('token failure', err);

    ctx.backData(403, {
      ILLEGAL_TOKEN: true,
      message: '非法 token',
      err,
    });
  }
};
