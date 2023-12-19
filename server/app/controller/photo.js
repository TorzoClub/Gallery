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
      const list = await ctx.app.model.Gallery.findAll({
        order: [
          [ 'index', 'DESC' ],
        ],
      });

      const photos_list = await Promise.all(
        list.map(gallery => {
          return gallery.getPhotos({
            order: [
              [ 'index', 'ASC' ],
            ],
          });
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

      const galleries = photos_list.map((photos, idx) => {
        const gallery = list[idx];

        if (gallery.in_event) {
          // 投票期间隐藏成员信息
          photos = photos.map(photo => {
            return { ...photo, member: null, member_id: null };
          });
        }

        return Object.assign(gallery.toJSON(), { photos });
      });

      const [ in_event_gallery ] = galleries.filter(gallery => gallery.in_event);
      ctx.backData(200, {
        active: in_event_gallery ? in_event_gallery : null,
        galleries: galleries.filter(gallery => !gallery.in_event),
      });
    }
  };
};
