'use strict';

module.exports = app => {
  const { INTEGER, VIRTUAL, STRING, TEXT } = app.Sequelize;

  const Photo = app.model.define('photo', {
    author: {
      type: STRING,
      allowNull: false,
    },

    desc: TEXT,

    src: {
      type: STRING(2048),
      allowNull: false,
      get() {
        const src = this.getDataValue('src');
        return app.serviceClasses.image.toSrcUrl(src);
      },
    },

    thumb: {
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
  });

  Photo.associate = () => {
    app.model.Photo.belongsTo(app.model.Gallery, { foreignKey: 'gallery_id' });
    app.model.Photo.hasMany(app.model.Vote, { foreignKey: 'photo_id' });
  };

  return Photo;
};
