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
        vote_limit: { type: 'integer', min: 0, required: true },
        event_start: { type: 'jsonDate', required: true },
        submission_expire: { type: 'jsonDate', required: true },
        event_end: { type: 'jsonDate', required: true },
      }, data);

      const newGallery = await ctx.service.gallery.create({
        name: data.name,
        index: data.index,
        event_start: new Date(data.event_start),
        submission_expire: new Date(data.submission_expire),
        event_end: new Date(data.event_end),
        vote_limit: data.vote_limit,
      });

      ctx.backData(200, newGallery);
    }

    async remove(ctx) {
      ctx.validate({
        id: { type: 'id', required: true },
      }, ctx.params);

      const { id } = ctx.params;
      const removed = await ctx.service.gallery.removeById(id);
      ctx.backData(200, removed);
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
        vote_limit: { type: 'integer', min: 0, required: false },
        event_start: { type: 'jsonDate', required: false },
        submission_expire: { type: 'jsonDate', required: false },
        event_end: { type: 'jsonDate', required: false },
      };
      ctx.validate(validOption, data);

      if (data.event_start) {
        data.event_start = new Date(data.event_start);
      }
      if (data.submission_expire) {
        data.submission_expire = new Date(data.submission_expire);
      }
      if (data.event_end) {
        data.event_end = new Date(data.event_end);
      }

      const created = await ctx.service.gallery.updateById(id, {
        ...data,
      });
      ctx.backData(200, created);
    }
  }

  return GalleryController;
};
