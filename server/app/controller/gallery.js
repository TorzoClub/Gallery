'use strict';

module.exports = app => {
  class GalleryController extends app.Controller {
    async submission(ctx) {
      ctx.validate({
        gallery_id: { type: 'id', required: true },
        qq_num: { type: 'qq_num', required: true },
      }, ctx.params);

      const photo = await ctx.service.photo.getMemberSubmissionByQQNum(
        ctx.params.gallery_id,
        ctx.params.qq_num
      );

      if (photo === null) {
        ctx.backData(200, null);
      } else {
        ctx.backData(
          200,
          {
            ...photo.toJSON(),
            member: await photo.getMember(),
          }
        );
      }
    }
  }

  return GalleryController;
};
