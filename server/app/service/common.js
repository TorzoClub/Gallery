'use strict';

const { Service } = require('egg');

module.exports = class CommonService extends Service {
  constructor() {
    super(...arguments);

    if (!this.OBJECT_NAME) {
      throw Error('使用 CommonService 时没有设置 OBJECT_NAME');
    }

    if (!this.Model) {
      throw Error('使用 CommonService 时没有设置 Model 属性');
    }
  }

  get ObjectName() {
    if (!this.OBJECT_NAME) {
      throw Error('没有设置 OBJECT_NAME');
    }

    return this.OBJECT_NAME;
  }

  async findById(id, transactionOptions = {}) {
    const item = await this.Model.findByPk(id, { ...transactionOptions });
    if (!item) {
      throw new this.ctx.app.WarningError(`${this.ObjectName}不存在`, 404);
    }

    return item;
  }

  async existsById(id, transactionOptions = {}) {
    return await this.Model.count({
      where: { id },
      ...transactionOptions,
    });
  }

  async detectExistsById(id, transactionOptions = {}) {
    const count = await this.existsById(id, transactionOptions);

    if (!count) {
      throw new this.ctx.app.WarningError(`${this.ObjectName}不存在`, 404);
    }

    return count;
  }

  async destroyById(id, transactionOptions = {}) {
    const item = await this.findById(id, transactionOptions);

    return item.destroy(transactionOptions);
  }
};
