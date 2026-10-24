'use strict';

const thorwRequire = message => {
  throw Error(message);
};

module.exports = () =>
  (ctx, next) => {
    ctx.backData = function(status = thorwRequire('require status'), value) {
      ctx.set('content-type', 'application/json');

      try {
        ctx.status = status;

        if (value instanceof Promise) {
          throw Error('backData: received a Promise Object');
        }

        if (value instanceof Error) {
          ctx.body = {
            message: value.message,
            ...value,
          };
        } else {
          ctx.body = JSON.stringify(value);
        }
      } catch (err) {
        throw Object.assign(err, { _isBackDataError: true });
      }
    };

    return next();
  };
