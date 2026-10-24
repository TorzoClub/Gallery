'use strict';

module.exports = app => {
  const Vote = app.model.define('vote', {
  });

  Vote.associate = () => {
    app.model.Vote.belongsTo(app.model.Photo, { foreignKey: 'photo_id' });
    app.model.Vote.belongsTo(app.model.Member, { foreignKey: 'member_id' });
    app.model.Vote.belongsTo(app.model.Gallery, { foreignKey: 'gallery_id' });
  };

  return Vote;
};
