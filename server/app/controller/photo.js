'use strict';

const fs = require('fs');
const path = require('path');
const stream = require('stream');
const util = require('util');
const { randomUUID } = require('crypto');
const pipeline = util.promisify(stream.pipeline);
const os = require('os');

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

    async processingMultipart(ctx) {
      const parts = ctx.multipart();
      const fields = {};
      const files = [];

      let part;
      while ((part = await parts()) != null) {
        if (Array.isArray(part)) {
          // fields
          const [ field, value ] = part;
          fields[field] = value;
        } else {
          // otherwise, it's a stream
          const { filename, fieldname, encoding, mime } = part;

          // how to handler?
          // 1. save to tmpdir with pipeline
          // 2. or send to oss
          // 3. or just consume it with another for await

          // WARNING: You should almost never use the origin filename as it could contain malicious input.
          const temp_path = path.join(os.tmpdir(), randomUUID() + path.extname(filename));
          await pipeline(part, fs.createWriteStream(temp_path)); // use `pipeline` not `pipe`
          files.push({
            temp_path,
            fieldname,
            filename,
            encoding,
            mime,
          });
        }
      }
      return [ files, fields ];
    }

    selectImageFile(files, required) {
      if (files.length === 0) {
        if (required) {
          throw new app.WarningError('缺少上传的文件', 400);
        } else {
          return null;
        }
      } else {
        const [ file ] = files;
        if (!/^image\//.test(file.mime)) {
          throw new app.WarningError(`文件需要是图片格式，当前提交mimetype的是: ${file.mime}`, 400);
        } else {
          return file;
        }
      }
    }

    async create(ctx) {
      const [ files, fields ] = await this.processingMultipart(ctx);

      // console.log('done fields', fields);
      // console.log('done files', files);

      const file = this.selectImageFile(files, true);

      const parsed_opts = {
        gallery_id: fields.gallery_id,
        qq_num: parseInt(fields.qq_num),
        desc: fields.desc,
      };

      ctx.validate({
        gallery_id: { type: 'id', required: true },
        qq_num: { type: 'qq_num', required: true },
        desc: { type: 'string', required: true, allowEmpty: true },
      }, parsed_opts);

      const result = await this.service.photo.createBySubmission({
        // mime,
        imagefile_path: file.temp_path,
        ...parsed_opts,
      });

      ctx.backData(200, result);
    }

    async edit(ctx) {
      const [ files, fields ] = await this.processingMultipart(ctx);
      const file = this.selectImageFile(files);

      const { photo_id } = ctx.params;
      ctx.validate({
        photo_id: { type: 'id', required: true },
      }, ctx.params);

      const parsed_opts = {
        qq_num: parseInt(fields.qq_num),
        desc: fields.desc,
      };

      ctx.validate({
        qq_num: { type: 'qq_num', required: true },
        desc: { type: 'string', required: false, allowEmpty: true },
      }, parsed_opts);

      const edit_data = {
        desc: parsed_opts.desc,
        imagefile_path: file ? file.temp_path : null,
      };

      ctx.backData(
        200,
        await this.service.photo.editSubmission(
          photo_id,
          parsed_opts.qq_num,
          edit_data
        )
      );
    }

    async remove(ctx) {
      ctx.validate({
        photo_id: { type: 'id', required: true },
      }, ctx.params);
      ctx.validate({
        qq_num: { type: 'qq_num', required: true },
      }, ctx.query);

      const photo = await this.service.photo.findById(parseInt(ctx.params.photo_id));

      const gallery = await this.service.gallery.findById(photo.gallery_id);
      this.service.photo.canSubmission(gallery);

      const member = await this.service.member.findOneByOptions({
        where: { qq_num: parseInt(ctx.query.qq_num) },
      });

      if (photo.member_id !== member.id) {
        throw Object.assign(new app.WarningError('相片不是该成员的投稿', 403), { SUBMISSION_AUTHOR_IS_NOT_CURRENT_MEMBER: true });
      } else {
        ctx.backData(200, await photo.destroy());
      }
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
