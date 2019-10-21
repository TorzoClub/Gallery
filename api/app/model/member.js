'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;

  const Member = app.model.define('member', {
    qq_num: {
      type: INTEGER(16),
      allowNull: false,
    },

    name: {
      type: STRING,
      allowNull: false,
    },
  });

  return Member;
};
