'use strict';

module.exports = app => {
  return class PhotoController extends app.Controller {
    async show(ctx) {
      ctx.validate({
        qq_num: { type: 'integer', required: true },
      }, ctx.request.body);

      const { qq_num } = ctx.request.body;
      const member = await ctx.service.member.findOneByOptions({
        where: {
          qq_num: parseInt(qq_num),
        },
      });

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
          const ownerMember = await photos[p].getMember();

          const vote = await ctx.service.vote.Model.findOne({
            where: {
              member_id: member.id,
              photo_id: photos[p].id,
              gallery_id: photos[p].gallery_id,
            },
          });

          const is_voted = Boolean(vote);

          photos[p] = {
            ...photos[p].toJSON(),
            is_voted,

            member: ownerMember,
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

        return Object.assign(gallery.toJSON(), {
          vote_submitted: !photos.every(photo => !photo.is_voted),
          photos,
        });
      });

      const [in_event_gallery] = galleries.filter(gallery => gallery.in_event);
      ctx.backData(200, {
        active: in_event_gallery ? in_event_gallery : null,
        galleries: galleries.filter(gallery => !gallery.in_event),
      });
    }
  };
};
