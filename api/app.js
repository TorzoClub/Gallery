'use strict';

/**
 * 启动app.js
 * @param {Object} app app
 */
module.exports = app => {
  app.beforeStart(async () => {
    const { env } = app.config;
    if (env === 'local') await app.model.sync({ force: false });
  });

  Object.assign(app, {
    WarningError: class WarningError extends Error {
      constructor(message, status) {
        super(...arguments);

        Object.assign(this, { status });
      }
    },
  });
};
