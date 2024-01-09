'use strict';

const { filesize } = require('filesize');
// const getFolderSize = require('get-folder-size');
const fs = require('fs');
const path = require('path');

async function getFileSize(path) {
  try {
    const { size } = await fs.promises.stat(path);
    return size;
  } catch (e) {
    return 0;
  }
}

module.exports = app => {
  class StatisticController extends app.Controller {
    async getAllMemberList(ctx) {
      const member_list = await ctx.model.Member.findAll({});
      return member_list;
    }

    async getSrcTotalSize(ctx, image_path, src_list) {
      const full_src_list = src_list
        .map(ctx.app.serviceClasses.image.allFilename)
        .flat();

      let total = 0;
      for (const src of full_src_list) {
        const size = await getFileSize(path.join(image_path, src));
        total = total + size;
      }
      return total;
    }

    async show(ctx) {
      const [ available_photo_list, member_list ] = await Promise.all([
        ctx.service.photo.getAvailablePhotoList(),
        this.getAllMemberList(ctx),
      ]);

      const src_list = [
        ...available_photo_list.map(p => p.src),
        ...member_list.map(m => m.avatar_src),
      ];

      const { imageSavePath, imageThumbSavePath } = ctx.app.config;

      const [ src_total_size_raw, thumb_total_size_raw ] = await Promise.all([
        this.getSrcTotalSize(ctx, imageSavePath, src_list),
        this.getSrcTotalSize(ctx, imageThumbSavePath, src_list),
      ]);

      ctx.backData(200, {
        available_photo_count: available_photo_list.length,
        src_total_size: filesize(src_total_size_raw),
        thumb_total_size: filesize(thumb_total_size_raw),
      });
    }
  }
  return StatisticController;
};
