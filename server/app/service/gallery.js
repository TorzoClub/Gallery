'use strict';

const CommonService = require('./common');

const ALLOW_KEYS = [
  'name',
  'index',
  'vote_limit',
  'event_start',
  'submission_expire',
  'event_end',
];

module.exports = class GalleryService extends CommonService {
  get OBJECT_NAME() {
    return '相册';
  }

  get Model() {
    return this.app.model.Gallery;
  }

  validTime([ event_start_date, submission_expire_date, event_end_date ]) {
    const event_start = event_start_date.valueOf();
    const submission_expire = submission_expire_date.valueOf();
    const event_end = event_end_date.valueOf();

    const val = (event_start < submission_expire) && (submission_expire < event_end);
    if (!val) {
      throw new this.app.WarningError('event_start、submission_expire、event_end 三个值必须是「event_start < submission_expire < event_end」这样的关系', 400);
    }
  }

  create(data) {
    const event_start = new Date(data.event_start);
    const submission_expire = new Date(data.submission_expire);
    const event_end = new Date(data.event_end);

    this.validTime([ event_start, submission_expire, event_end ]);

    return this.Model.create({
      name: data.name,
      index: data.index,
      event_start,
      submission_expire,
      event_end,
      vote_limit: data.vote_limit,
    });
  }

  filterData(data) {
    const new_data = {};
    ALLOW_KEYS.forEach(k => {
      if (data.hasOwnProperty(k)) {
        new_data[k] = data[k];
      }
    });
    return new_data;
  }

  async updateById(id, data) {
    const gallery = await this.Model.findByPk(id);
    if (gallery) {
      Object.assign(gallery, this.filterData(data));
      this.validTime([ gallery.event_start, gallery.submission_expire, gallery.event_end ]);

      return gallery.save();
    } else {
      throw new this.app.WarningError('相册不存在', 404);
    }
  }

  async removeById(id) {
    return this.app.model.transaction(async transaction => {
      const transaction_opts = { transaction, lock: transaction.LOCK.UPDATE };
      const gallery = await this.findById(id, transaction_opts);

      const photos = await this.ctx.service.photo.getListByGalleryIdWithTransaction(
        gallery.id,
        transaction_opts
      );

      for (const photo of photos) {
        await this.ctx.service.photo.removeByIdWithTransaction(photo.id, transaction_opts);
      }

      return await gallery.destroy(transaction_opts);
    });
  }
};
