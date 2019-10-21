'use strict';

module.exports = app => {
  const { BIGINT, STRING } = app.Sequelize;

  const Member = app.model.define('member', {
    qq_num: {
      type: BIGINT,
      allowNull: false,
    },

    name: {
      type: STRING,
      allowNull: false,
    },
  });

  return Member;
};
