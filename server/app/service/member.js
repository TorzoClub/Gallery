'use strict';

const fs = require('fs');

const { Service } = require('egg');

class MemberService extends Service {
  get Model() {
    return this.ctx.model.Member;
  }

  async create(data) {
    return this.app.model.transaction(async transaction => {
      const { qq_num, avatar_src } = data;

      const member = await this.Model.findOne({
        where: {
          qq_num,
        },

        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (member) {
        throw new this.ctx.app.WarningError('重复QQ号的成员', 409);
      }

      const srcPath = await this.app.serviceClasses.image.toLocalSrcPath(avatar_src);
      if (!fs.existsSync(srcPath)) {
        throw new this.app.WarningError('src不存在', 404);
      }

      return await this.Model.create(data, { transaction });
    });
  }

  get editableProperty() {
    return [ 'qq_num', 'avatar_src', 'name' ];
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
