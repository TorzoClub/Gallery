'use strict';

module.exports = app => {
  const { BIGINT, STRING, VIRTUAL } = app.Sequelize;

  const Member = app.model.define('member', {
    qq_num: {
      type: BIGINT,
      allowNull: false,
    },

    avatar_src: {
      type: STRING(2048),
      allowNull: false,
      get() {
        const src = this.getDataValue('avatar_src');
        return app.serviceClasses.image.toSrcUrl(src);
      },
    },

    avatar_thumb: {
      type: VIRTUAL,
      get() {
        const src = this.getDataValue('avatar_src');
        return app.serviceClasses.image.toThumbUrl(src);
      },
    },

    name: {
      type: STRING,
      allowNull: false,
    },
  });

  Member.associate = () => {
    app.model.Member.hasMany(app.model.Photo, { foreignKey: 'member_id' });
  };

  return Member;
};
