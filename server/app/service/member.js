'use strict';

const fs = require('fs');

const CommonService = require('./common');

class MemberService extends CommonService {
  get OBJECT_NAME() {
    return '成员';
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
      const member = await this.findById(id, { transaction });

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

  async removeMemberGalleryVote({ member_id, gallery_id }) {
    return this.app.model.transaction(async transaction => {
      const transactionOptions = { transaction, lock: transaction.LOCK.UPDATE };

      const member = await this.findById(member_id, { ...transactionOptions });

      const voteList = await this.service.vote.Model.findAll({
        where: {
          gallery_id,
          member_id: member.id,
        },

        ...transactionOptions,
      });

      for (let i = 0; i < voteList.length; ++i) {
        const vote = voteList[i];

        await vote.destroy({ ...transactionOptions });
      }

      for (let i = 0; i < voteList.length; ++i) {
        const vote = voteList[i];

        await this.service.photo.reComputeVoteCount({
          photo_id: vote.photo_id,
        }, transactionOptions);
      }

      return voteList;
    });
  }
}

module.exports = MemberService;
