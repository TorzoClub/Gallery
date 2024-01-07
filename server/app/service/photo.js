'use strict';

const CommonService = require('./common');

module.exports = app =>
  class PhotoService extends CommonService {
    get OBJECT_NAME() {
      return '照片';
    }

    get Model() {
      return this.app.model.Photo;
    }

    async getMemberSubmissionByQQNum(gallery_id, qq_num) {
      const galleryP = this.service.gallery.findById(parseInt(gallery_id));
      const memberP = this.service.member.findOneByOptions({
        where: { qq_num: parseInt(qq_num) },
      });

      const gallery = await galleryP;
      const member = await memberP;

      return this.Model.findOne({
        where: {
          gallery_id: gallery.id,
          member_id: member.id,
        },
      });
    }

    async createBySubmission({ imagefile_path, qq_num, gallery_id, desc }) {
      const created_file = await this.service.image.storeByFilePath(imagefile_path);

      const created_photo = await this.service.photo.createByQQNum({
        qq_num, gallery_id, desc, src: created_file.src,
      });

      return created_photo.toJSON();
    }

    canSubmission(gallery) {
      if (!gallery.in_event) {
        throw Object.assign(new app.WarningError('无法投稿，因为该相册不在活动期间', 403), { IS_NOT_EVENT_PERIOD: true });
      } else if (!gallery.can_submission) {
        throw Object.assign(new app.WarningError('无法投稿，因为该相册已过投稿期限', 403), { IS_NOT_SUBMISSION_PERIOD: true });
      }
    }

    async editSubmission(photo_id, qq_num, edit_data) {
      const member = await this.service.member.findOneByOptions({
        where: { qq_num: parseInt(qq_num) },
      });

      const photo = await this.service.photo.findById(photo_id);

      if (photo.member_id !== member.id) {
        throw Object.assign(new app.WarningError('相片不是该成员的投稿', 403), { SUBMISSION_AUTHOR_IS_NOT_CURRENT_MEMBER: true });
      }

      const gallery = await this.service.gallery.findById(photo.gallery_id);
      this.canSubmission(gallery);

      const update_data = {};
      if (edit_data.desc !== undefined) {
        update_data.desc = edit_data.desc;
      }
      if (edit_data.imagefile_path) {
        const created_file = await this.service.image.storeByFilePath(
          edit_data.imagefile_path
        );
        update_data.src = created_file.src;
      }

      return this.edit(photo.id, {
        ...update_data,
      });
    }

    async createByQQNum({ qq_num, gallery_id, src, desc }) {
      const member = await this.service.member.findOneByOptions({
        where: { qq_num: parseInt(qq_num) },
      });

      const gallery = await this.service.gallery.findById(gallery_id);
      this.canSubmission(gallery);
      return this.create({
        member_id: member.id,
        gallery_id,
        src,
        desc,
      });
    }

    async create(data) {
      return this.app.model.transaction(async transaction => {
        const { member_id, gallery_id, src, desc } = data;

        await this.service.member.detectExistsById(member_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        await this.service.gallery.detectExistsById(gallery_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const exists = await this.Model.findOne({
          where: {
            gallery_id,
            member_id,
          },

          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (exists) {
          throw new this.ctx.app.WarningError('该成员已经投稿过了，不能重复投稿', 409);
        } else {
          const { width, height } = await app.serviceClasses.image.getImageDimensions(src);
          return await this.Model.create({
            member_id: parseInt(member_id),
            gallery_id: parseInt(gallery_id),
            desc,
            src,
            width,
            height,
          }, { transaction, lock: transaction.LOCK.UPDATE });
        }
      });
    }

    get editableProperty() {
      return [ 'member_id', 'gallery_id', 'desc', 'src' ];
    }

    async edit(id, data) {
      return this.app.model.transaction(async transaction => {
        const transaction_opts = { transaction, lock: transaction.LOCK.UPDATE };
        const photo = await this.findById(id, transaction_opts);

        if (data.hasOwnProperty('member_id')) {
          // 检查成员是否存在
          await this.service.member.detectExistsById(data.member_id, transaction_opts);
        }

        if (data.hasOwnProperty('gallery_id')) {
          // 检查相册是否存在
          await this.service.gallery.detectExistsById(data.gallery_id, transaction_opts);
        }

        const old_src = photo.src;

        this.editableProperty.forEach(key => {
          if (data.hasOwnProperty(key)) {
            photo[key] = data[key];
          }
        });

        if (photo.src !== old_src) {
          const { width, height } = await app.serviceClasses.image.getImageDimensions(photo.src);
          Object.assign(photo, { width, height });

          const result = await photo.save(transaction_opts);

          await app.serviceClasses.image.removeSrc(old_src);

          return result;
        } else {
          return await photo.save(transaction_opts);
        }
      });
    }

    async getListByGalleryIdWithTransaction(gallery_id, transaction_opts = {}) {
      gallery_id = parseInt(gallery_id);
      const result = await this.service.gallery.detectExistsById(gallery_id, transaction_opts);
      if (!result) {
        throw new this.ctx.app.WarningError('相册不存在', 404);
      }

      const list = await this.Model.findAll({
        include: [{
          model: this.app.model.Member,
        }],

        where: {
          gallery_id,
        },

        ...transaction_opts,
      });

      return list;
    }

    getListByGalleryId({ gallery_id }) {
      return this.app.model.transaction(async transaction => {
        return await this.getListByGalleryIdWithTransaction(gallery_id, { transaction });
      });
    }

    getVoteOrderListByGalleryId({ gallery_id }) {
      return this.app.model.transaction(async transaction => {
        gallery_id = parseInt(gallery_id);

        await this.service.gallery.detectExistsById(gallery_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const list = await this.Model.findAll({
          where: {
            gallery_id,
          },

          order: [
            [ 'vote_count', 'DESC' ],
          ],

          transaction,
        });

        return list;
      });
    }

    getMemberVoteListByGalleryId({ gallery_id }) {
      return this.app.model.transaction(async transaction => {
        gallery_id = parseInt(gallery_id);

        await this.service.gallery.detectExistsById(gallery_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const memberList = await this.service.member.Model.findAll({
          transaction,
        });

        const votes = memberList.map(member => {
          return this.service.vote.Model.findAll({
            where: {
              member_id: member.id,
              gallery_id,
            },

            transaction,
          });
        });

        const voteList = await Promise.all(votes);

        return memberList.map((mem, idx) => {
          const member = {
            ...mem.toJSON(),
            votes: voteList[idx],
          };

          return member;
        });
      });
    }

    sortByVoteCount({ gallery_id }) {
      return this.app.model.transaction(async transaction => {
        gallery_id = parseInt(gallery_id);

        await this.service.gallery.detectExistsById(gallery_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const photoList = await this.service.photo.Model.findAll({
          transaction,
          lock: transaction.LOCK.UPDATE,

          order: [
            [ 'vote_count', 'DESC' ],
          ],
        });

        const saveSeries = photoList.map((photo, idx) => {
          photo.index = idx;

          return photo.save({
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
        });

        return Promise.all(saveSeries);
      });
    }

    async removeByIdWithTransaction(id, transaction_opts) {
      const photo = await this.findById(parseInt(id), transaction_opts);

      await app.serviceClasses.image.removeSrc(photo.src);

      return await photo.destroy(transaction_opts);
    }

    removeById(id) {
      return this.app.model.transaction(async transaction => {
        return await this.removeByIdWithTransaction(id, {
          transaction, lock: transaction.LOCK.UPDATE,
        });
      });
    }

    async reComputeVoteCount({ photo_id }, transaction_opts = {}) {
      const photo = await this.findById(photo_id, transaction_opts);

      const voteCount = await this.service.vote.Model.count({
        where: {
          photo_id: photo.id,
        },

        ...transaction_opts,
      });

      photo.vote_count = voteCount;

      return photo.save({ ...transaction_opts });
    }
  };
