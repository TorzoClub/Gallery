'use strict';

const CommonService = require('./common');

module.exports = app =>
  class VoteService extends CommonService {
    get OBJECT_NAME() {
      return '投票';
    }

    get Model() {
      return this.app.model.Vote;
    }

    async create({ gallery_id, photo_id, qq_num }) {
      return this.app.model.transaction(async transaction => {
        const UpdateLockOptions = { transaction, lock: transaction.LOCK.UPDATE };

        const gallery = await this.service.gallery.findById(gallery_id, UpdateLockOptions);

        const photo = await this.service.photo.findById(photo_id, UpdateLockOptions);

        if (photo.gallery_id !== gallery.id) {
          throw new app.WarningError('相册和照片不匹配', 404);
        }

        const member = await this.service.member.findOneByOptions({
          where: { qq_num },
          ...UpdateLockOptions,
        });

        const voteExists = await this.existsByOptions({
          where: {
            gallery_id: gallery.id,
            photo_id: photo.id,
            member_id: member.id,
          },

          transaction,
          lock: transaction.LOCK.SHARE,
        });

        if (voteExists) {
          throw new app.WarningError('已经投过这个相片了', 409);
        }

        if (gallery.vote_limit !== 0) {
          // 检查成员有没有达到相册投票次数的限制

          const voteCount = await this.Model.count({
            where: {
              gallery_id: gallery.id,
              member_id: member.id,
            },

            transaction,
            lock: transaction.LOCK.SHARE,
          });

          if (voteCount >= gallery.vote_limit) {
            throw new app.WarningError('票数限制', 403);
          }
        }

        await photo.increment('vote_count', { by: 1, ...UpdateLockOptions });

        return await this.Model.create({
          gallery_id: gallery.id,
          photo_id: photo.id,
          member_id: member.id,
        }, { transaction });
      });
    }
  };
