'use strict';

class WarningError extends Error {
  constructor(message, status) {
    super(...arguments);

    Object.assign(this, { status });
  }
}

class AppBootHook {
  constructor(app) {
    this.app = app;

    Object.assign(app, {
      WarningError,
    });
  }

  async willReady() {
    const { app } = this;
    const { env /* , startBeforeGenerateThumb */ } = app.config;

    if (env === 'local') {
      await app.model.sync({
        alter: true,
        force: false,
      });
    }
  }
}

module.exports = AppBootHook;
