'use strict';

const validError = (ctx, err) => {
  const { errors } = err;
  const error = errors.pop();
  const { code } = error;

  if (code === 'missing_field') {
    ctx.backData(400, {
      message: `缺少[${error.field}]字段`,
    });
  } else if (code === 'invalid') {
    ctx.backData(400, {
      message: `参数[${error.field}]校验失败，原因: '${error.message}'`,
    });
  } else {
    ctx.backData(400, {
      message: '参数错误',
      error,
    });
  }
};

module.exports = () =>
  async (ctx, next) => {

    try {
      await next();
    } catch (err) {
      const { message } = err;
      if (message === 'Validation Failed') {
        validError(ctx, err);
        return;
      }

      const { WarningError } = ctx.app;

      if (err instanceof WarningError) {
        const status = err.status || 500;

        ctx.backData(status, {
          status,
          message: err.message,
        });

        return;
      }

      console.error('error:', err);

      ctx.backData(500, {
        ...err,
        message: err.message,
      });
    }
  };
