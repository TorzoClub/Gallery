'use strict';

const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const CommonService = require('./common');

module.exports = app =>
  class VoteService extends CommonService {
    get OBJECT_NAME() {
      return '投票';
    }

    get Model() {
      return this.app.model.Vote;
    }

    async create({ gallery_id, photo_id_list, qq_num }) {
      return this.app.model.transaction(async transaction => {
        const UpdateLockOptions = { transaction, lock: transaction.LOCK.UPDATE };

        const gallery = await this.service.gallery.findById(gallery_id, UpdateLockOptions);

        if (gallery.is_expired) {
          throw Object.assign(new app.WarningError('已过投票截止时间', 403), { VOTE_EXPIRED: true });
        }

        const photo_list = await this.service.photo.Model.findAll({
          where: {
            gallery_id,
            id: {
              [Op.or]: photo_id_list,
            },
          },
          ...UpdateLockOptions,
        });

        if (!photo_list.length || !photo_list.length) {
          throw new app.WarningError('照片不存在', 404);
        }

        if (photo_list.length !== photo_id_list.length) {
          throw new app.WarningError('相册和照片数量不匹配', 404);
        }

        const member = await this.service.member.findOneByOptions({
          where: { qq_num },
          ...UpdateLockOptions,
        });

        const voteExists = await this.existsByOptions({
          where: {
            gallery_id: gallery.id,
            member_id: member.id,
          },

          transaction,
          lock: transaction.LOCK.SHARE,
        });

        if (voteExists) {
          throw new app.WarningError('这个相册已经投过票了', 409);
        }

        if (gallery.vote_limit !== 0) {
          // 检查提交的投票有没有达到相册投票次数的限制

          if (photo_id_list.length > gallery.vote_limit) {
            throw new app.WarningError('票数限制', 403);
          }
        }

        const result_list = [];

        for (let i = 0; i < photo_list.length; ++i) {
          const photo = photo_list[i];

          await photo.increment('vote_count', { by: 1, ...UpdateLockOptions });

          const newVote = await this.Model.create({
            gallery_id: gallery.id,
            photo_id: photo.id,
            member_id: member.id,
          }, { transaction });

          result_list.push(newVote);
        }

        return result_list;
      });
    }
  };
