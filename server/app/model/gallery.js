'use strict';

module.exports = app => {
  const { INTEGER, STRING, DATE, VIRTUAL } = app.Sequelize;

  const Gallery = app.model.define('gallery', {
    name: {
      // 名称
      type: STRING,
      allowNull: false,
    },

    index: {
      // 排序
      type: INTEGER,
      allowNull: false,
    },

    event_start: {
      // 活动开始时间
      type: DATE,
      allowNull: false,
    },

    submission_expire: {
      // 征集投稿结束时间，它的范围应该是要在活动开始时间和活动结束时间以内的
      type: DATE,
      allowNull: false,
    },

    event_end: {
      // 活动结束时间，即以前的“vote_expire”
      type: DATE,
      allowNull: false,
    },

    can_submission: {
      // 是否可以投稿
      // 在 event_start～submission_expire 这个时间范围内才显示为 true
      type: VIRTUAL,
      get() {
        const now_date = new Date
        const submission_expire_date = this.getDataValue('submission_expire')
        return (
          (now_date.valueOf() < submission_expire_date.valueOf()) &&
          this.in_event
        )
      },
    },

    in_event: {
      // 正在活动期间
      type: VIRTUAL,
      get() {
        const now_date = new Date
        const start_date = this.getDataValue('event_start')
        const end_date = this.getDataValue('event_end')

        return (
          (now_date.valueOf() >= start_date.valueOf()) &&
          (now_date.valueOf() <= end_date.valueOf())
        )
      },
    },

    vote_limit: {
      // 投票限制，每张照片的限投次数，若为0则无限制
      type: INTEGER,
      allowNull: false,
      default: 0,
    },
  });

  Gallery.associate = () => {
    app.model.Gallery.hasMany(app.model.Photo, { foreignKey: 'gallery_id' });
  };

  return Gallery;
};
