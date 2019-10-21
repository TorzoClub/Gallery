'use strict';

module.exports = app => {
  const { INTEGER, STRING, DATE } = app.Sequelize;

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

    vote_expire: {
      // 投票截止时间
      type: DATE,
      allowNull: false,
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
