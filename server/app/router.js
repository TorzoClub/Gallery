'use strict';

const path = require('path');

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { config, controller, middlewares } = app;

  const setRouter = (method, set_path, ...middlewareArgs) => {
    return app.router[method](
      path.join(
        config.apiPrefix,
        set_path
      ),
      ...middlewareArgs
    );
  };

  const setAdminRouter = (method, path, ...middlewareArgs) => {
    return setRouter(method, `admin/${path}`, middlewares.admin, ...middlewareArgs);
  };

  setRouter('post', 'admin/login', controller.admin.auth.login);

  setAdminRouter('post', 'image/upload', controller.admin.image.upload);
  setAdminRouter('get', 'image/refresh-thumb', controller.admin.image.refreshThumb);

  {
    const { create, remove, get, show, edit } = controller.admin.gallery;
    setAdminRouter('post', 'gallery', create);
    setAdminRouter('delete', 'gallery/:id', remove);
    setAdminRouter('get', 'gallery/:id', get);
    setAdminRouter('get', 'gallery', show);
    setAdminRouter('patch', 'gallery/:id', edit);
  }

  {
    const { create, remove, get, show, edit, removeMemberGalleryVote } = controller.admin.member;
    setAdminRouter('post', 'member', create);
    setAdminRouter('delete', 'member/:id', remove);
    setAdminRouter('get', 'member/:id', get);
    setAdminRouter('get', 'member', show);
    setAdminRouter('patch', 'member/:id', edit);

    setAdminRouter('delete', 'member/:id/gallery/:gallery_id/vote', removeMemberGalleryVote);
  }

  {
    const { create, remove, show, get, showPhotoVote, showMemberVote, sortByVoteCount, edit } = controller.admin.photo;
    setAdminRouter('post', 'photo', create);
    setAdminRouter('delete', 'photo/:id', remove);
    setAdminRouter('get', 'photo/:id', get);
    setAdminRouter('get', 'gallery/:gallery_id/photo', show);
    setAdminRouter('get', 'gallery/:gallery_id/photo_vote', showPhotoVote);
    setAdminRouter('get', 'gallery/:gallery_id/member_vote', showMemberVote);
    setAdminRouter('put', 'gallery/:gallery_id/photo/sortByVoteCount', sortByVoteCount);
    setAdminRouter('patch', 'photo/:id', edit);
  }

  setRouter('post', 'member/photo', controller.member.photo.show);
  setRouter('post', 'member/vote', controller.member.vote.create);

  setRouter('get', 'member/confirm/:qq_num', controller.member.index.confirm);

  setRouter('get', 'photo', controller.photo.show);
  setRouter('get', 'photo/:id', controller.photo.get);
  setRouter('post', 'photo', controller.photo.create);
  setRouter('post', 'photo/:photo_id', controller.photo.edit);
};
