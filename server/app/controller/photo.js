'use strict';

module.exports = app => {
  return class PhotoController extends app.Controller {
    async get(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;

      const photo = await ctx.service.photo.findById(id);
      ctx.backData(200, {
        ...photo.toJSON(),
        member: await photo.getMember(),
      });
    }

    async show(ctx) {
      const list = await ctx.app.model.Gallery.findAll();

      const photos_list = await Promise.all(
        list.map(gallery => {
          return gallery.getPhotos();
        })
      );

      for (let i = 0; i < photos_list.length; ++i) {
        const photos = photos_list[i];

        for (let p = 0; p < photos.length; ++p) {
          const member = await photos[p].getMember();

          photos[p] = {
            ...photos[p].toJSON(),
            member,
          };
        }
      }

      ctx.backData(
        200,
        photos_list.map((photos, idx) => {
          const gallery = list[idx];
          return Object.assign(gallery.toJSON(), { photos });
        })
      );
    }
  };
};
