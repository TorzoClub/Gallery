'use strict';

const { Service } = require('egg');

class MemberService extends Service {
  get Model() {
    return this.ctx.model.Member;
  }

  async create(data) {
    const { qq_num } = data;

    const member = await this.Model.findOne({
      where: {
        qq_num,
      },
    });

    if (member) {
      throw new this.ctx.app.WarningError('重复QQ号的成员', 409);
    }

    return await this.Model.create(data);
  }

  get editableProperty() {
    return [ 'qq_num', 'name' ];
  }

  async edit(id, data) {
    const member = await this.Model.findByPk(id);

    if (!member) {
      throw new this.ctx.app.WarningError('找不到该成员', 404);
    }

    if (data.hasOwnProperty('qq_num') && (member.qq_num !== data.qq_num)) {
      const sameQQNumMember = await this.Model.findOne({
        where: {
          qq_num: data.qq_num,
        },
      });

      if (sameQQNumMember) {
        throw new this.ctx.app.WarningError('无法更新，所修改的QQ号已被占用', 409);
      }
    }

    this.editableProperty.forEach(key => {
      if (data.hasOwnProperty(key)) {
        member[key] = data[key];
      }
    });

    return await member.save();
  }
}

module.exports = MemberService;
