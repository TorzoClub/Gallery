'use strict';

const fs = require('fs');

module.exports = app => {
  const { INTEGER, VIRTUAL, STRING, TEXT } = app.Sequelize;

  const Photo = app.model.define('photo', {
    desc: TEXT,

    src: {
      type: STRING(2048),
      allowNull: false,

      set(src) {
        const localPath = app.serviceClasses.image.toSrcSavePath(src);
        if (!fs.existsSync(localPath)) {
          throw new app.WarningError('src is not exists', 400);
        }

        return this.setDataValue('src', src);
      },
    },

    src_urlpath: {
      type: VIRTUAL,
      get() {
        const src = this.getDataValue('src');
        return app.serviceClasses.image.toSrcUrlPath(src);
      },
    },

    src_url: {
      type: VIRTUAL,
      get() {
        const src = this.getDataValue('src');
        return app.serviceClasses.image.toSrcUrl(src);
      },
    },

    thumb: {
      type: VIRTUAL,
      get() {
        const src = this.getDataValue('src');
        return app.serviceClasses.image.toThumbFilename(src);
      },
    },

    thumb_urlpath: {
      type: VIRTUAL,
      get() {
        const src = this.getDataValue('src');
        return app.serviceClasses.image.toThumbUrlPath(src);
      },
    },

    thumb_url: {
      type: VIRTUAL,
      get() {
        const src = this.getDataValue('src');
        return app.serviceClasses.image.toThumbUrl(src);
      },
    },

    width: {
      type: INTEGER,
      allowNull: false,
    },

    height: {
      type: INTEGER,
      allowNull: false,
    },

    vote_count: {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },

    index: {
      type: INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
  });

  Photo.associate = () => {
    app.model.Photo.belongsTo(app.model.Member, { foreignKey: 'member_id' });

    app.model.Photo.belongsTo(app.model.Gallery, { foreignKey: 'gallery_id' });
    app.model.Photo.hasMany(app.model.Vote, { foreignKey: 'photo_id' });
  };

  return Photo;
};
