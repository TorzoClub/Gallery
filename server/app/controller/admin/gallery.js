'use strict';

const isValidDate = d => d instanceof Date && !isNaN(d);
const isValidJsonDate = str => {
  if (typeof str !== 'string') {
    return false;
  }

  const date = new Date(str);

  if (!isValidDate(date)) {
    return false;
  }

  if (date.toISOString() !== str) {
    return false;
  }

  return true;
};

module.exports = app => {
  app.validator.addRule('jsonDate', (rule, value) => {
    if (!isValidJsonDate(value)) {
      return '非法日期格式，只接受 ISO 格式';
    }
  });

  class GalleryController extends app.Controller {
    async create(ctx) {
      const { body: data } = ctx.request;
      ctx.validate({
        name: { type: 'string', required: true },
        index: { type: 'integer', required: true },
        vote_expire: { type: 'jsonDate', required: true },
        vote_limit: { type: 'integer', min: 0, required: true },
      }, data);

      const newGallery = await ctx.service.gallery.create({
        name: data.name,
        index: data.index,
        vote_expire: new Date(data.vote_expire),
        vote_limit: data.vote_limit,
      });

      ctx.backData(200, newGallery);
    }

    async remove(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      const removedGallery = await ctx.service.gallery.removeById(id);
      ctx.backData(200, removedGallery);
    }

    async show(ctx) {
      const list = await ctx.model.Gallery.findAll();
      ctx.backData(200, list);
    }

    async get(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      ctx.backData(200, await ctx.service.gallery.findById(id));
    }

    async edit(ctx) {
      const { id } = ctx.params;
      const { body: data } = ctx.request;

      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const validOption = {
        name: { type: 'string', required: false },
        index: { type: 'integer', required: false },
        vote_expire: { type: 'jsonDate', required: false },
        vote_limit: { type: 'integer', min: 0, required: false },
      };
      ctx.validate(validOption, data);

      if (data.vote_expire) {
        data.vote_expire = new Date(data.vote_expire);
      }

      const gallery = await ctx.model.Gallery.findByPk(id);
      if (gallery) {
        Object.keys(validOption).forEach(key => {
          if (data.hasOwnProperty(key)) {
            gallery[key] = data[key];
          }
        });

        ctx.backData(200, await gallery.save());
      } else {
        throw new app.WarningError('相册不存在', 404);
      }
    }
  }

  return GalleryController;
};
