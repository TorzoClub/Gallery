'use strict';

const fs = require('fs');

const { Service } = require('egg');

class MemberService extends Service {
  async findById(id, transactionOptions = {}) {
    const member = await this.Model.findByPk(id, { ...transactionOptions });
    if (!member) {
      throw new this.ctx.app.WarningError('成员不存在', 404);
    }

    return member;
  }

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
    return this.app.model.transaction(async transaction => {
      const member = await this.Model.findByPk(id, { transaction });

      if (!member) {
        throw new this.ctx.app.WarningError('找不到该成员', 404);
      }

      if (data.hasOwnProperty('qq_num') && (member.qq_num !== data.qq_num)) {
        // 检查所修改的QQ号是否被占用

        const sameQQNumMember = await this.Model.count({
          where: {
            qq_num: data.qq_num,
          },

          transaction,
          lock: transaction.LOCK.UPDATE,
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

      return await member.save({ transaction });
    });
  }

  async removeById(id) {
    return this.app.model.transaction(async transaction => {
      const member = await this.findById(id, { transaction, lock: transaction.LOCK.UPDATE });

      return await member.destroy({ transaction });
    });
  }
}

module.exports = MemberService;
