'use strict';

const { Service } = require('egg');

module.exports = app =>
  class VoteService extends Service {
    get GalleryModel() {
      return this.ctx.model.Gallery;
    }

    get PhotoModel() {
      return this.ctx.model.Photo;
    }

    get VoteModel() {
      return this.ctx.model.Vote;
    }

    get MemberModel() {
      return this.ctx.model.Member;
    }

    async create({ gallery_id, photo_id, qq_num }) {
      const gallery = await this.GalleryModel.findByPk(gallery_id);
      if (!gallery) {
        throw new app.WarningError('相册不存在', 404);
      }

      const photo = await this.PhotoModel.findByPk(photo_id);
      if (!photo) {
        throw new app.WarningError('照片不存在', 404);
      }

      if (photo.gallery_id !== gallery.id) {
        throw new app.WarningError('相册和照片不匹配', 404);
      }

      const member = await this.MemberModel.findOne({
        where: { qq_num },
      });
      if (!member) {
        throw new app.WarningError('成员不存在', 404);
      }

      const vote = await this.VoteModel.findOne({
        where: { gallery_id, photo_id, member_id: member.id },
      });

      if (vote) {
        throw new app.WarningError('已经投过这个相片了', 409);
      }

      if (gallery.vote_limit > 0) {
        if (photo.vote_count > gallery.vote_limit) {
          throw new app.WarningError('票数限制', 403);
        }
      }

      photo.increment('vote_count', { by: 1 });

      return await this.VoteModel.create({
        gallery_id,
        photo_id,
        member_id: member.id,
      });
    }
  };
