'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { controller, middlewares } = app;

  const setRouter = (method, path, ...middlewareArgs) => {
    return app.router[method](`/api/${path}`, ...middlewareArgs);
  };

  const setAdminRouter = (method, path, ...middlewareArgs) => {
    return setRouter(method, `admin/${path}`, middlewares.admin, ...middlewareArgs);
  };

  setRouter('post', 'admin/login', controller.admin.auth.login);

  setAdminRouter('post', 'image/upload', controller.admin.image.upload);

  {
    const { create, remove, show, edit } = controller.admin.gallery;
    setAdminRouter('post', 'gallery', create);
    setAdminRouter('delete', 'gallery/:id', remove);
    setAdminRouter('get', 'gallery', show);
    setAdminRouter('patch', 'gallery/:id', edit);
  }

  {
    const { create, remove, show, edit } = controller.admin.member;
    setAdminRouter('post', 'member', create);
    setAdminRouter('delete', 'member/:id', remove);
    setAdminRouter('get', 'member', show);
    setAdminRouter('patch', 'member/:id', edit);
  }

  {
    const { create, remove, show, edit } = controller.admin.photo;
    setAdminRouter('post', 'photo', create);
    setAdminRouter('delete', 'photo/:id', remove);
    setAdminRouter('get', 'gallery/:gallery_id/photo', show);
    setAdminRouter('patch', 'photo/:id', edit);
  }

  setRouter('post', 'vote', controller.vote.create);
};
