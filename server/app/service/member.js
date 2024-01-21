'use strict';

const fs = require('fs');

const CommonService = require('./common');

module.exports = app =>
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

        const srcPath = await this.app.serviceClasses.image.toSrcSavePath(avatar_src);
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
        const transaction_opts = { transaction, lock: transaction.LOCK.UPDATE };

        const member = await this.findById(id, transaction_opts);

        if (data.hasOwnProperty('qq_num') && (member.qq_num !== data.qq_num)) {
          // 检查所修改的QQ号是否被占用

          const sameQQNumMember = await this.Model.count({
            where: {
              qq_num: data.qq_num,
            },

            ...transaction_opts,
          });

          if (sameQQNumMember) {
            throw new this.ctx.app.WarningError('无法更新，所修改的QQ号已被占用', 409);
          }
        }

        const old_avatar_src = member.avatar_src;

        this.editableProperty.forEach(key => {
          if (data.hasOwnProperty(key)) {
            member[key] = data[key];
          }
        });

        // await app.serviceClasses.image.removeSrc(member.avatar_src);
        if (member.avatar_src !== old_avatar_src) {
          await app.serviceClasses.image.getImageDimensions(member.avatar_src);

          const result = await member.save(transaction_opts);

          await app.serviceClasses.image.removeSrc(old_avatar_src);

          return result;
        } else {
          return await member.save(transaction_opts);
        }
      });
    }

    async removeById(id) {
      return this.app.model.transaction(async transaction => {
        const transaction_opts = { transaction, lock: transaction.LOCK.UPDATE };

        const member = await this.findById(id, transaction_opts);

        const where = { member_id: member.id };
        const photo_count = await this.service.photo.Model.count({
          where, ...transaction_opts,
        });

        if (photo_count > 0) {
          throw new this.ctx.app.WarningError('无法删除成员，因为这个成员有投稿', 409);
        } else {
          const vote_count = await this.service.vote.Model.count({
            where, ...transaction_opts,
          });

          if (vote_count > 0) {
            throw new this.ctx.app.WarningError('无法删除成员，因为这个成员有投票', 409);
          }

          await app.serviceClasses.image.removeSrc(member.avatar_src);

          return await member.destroy(transaction_opts);
        }
      });
    }

    async removeMemberGalleryVote({ member_id, gallery_id }) {
      return this.app.model.transaction(async transaction => {
        return this.removeMemberGalleryVoteWithTransaction(
          { member_id, gallery_id },
          { transaction, lock: transaction.LOCK.UPDATE }
        );
      });
    }

    async removeMemberGalleryVoteWithTransaction(
      { member_id, gallery_id },
      transaction_opts = {}
    ) {
      const member = await this.findById(member_id, { ...transaction_opts });

      const voteList = await this.service.vote.Model.findAll({
        where: {
          gallery_id,
          member_id: member.id,
        },

        ...transaction_opts,
      });

      for (let i = 0; i < voteList.length; ++i) {
        const vote = voteList[i];

        await vote.destroy({ ...transaction_opts });
      }

      for (let i = 0; i < voteList.length; ++i) {
        const vote = voteList[i];

        await this.service.photo.reComputeVoteCount({
          photo_id: vote.photo_id,
        }, transaction_opts);
      }

      return voteList;
    }
  };
