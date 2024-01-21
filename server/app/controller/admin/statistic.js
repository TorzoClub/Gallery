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

    async calcFilesSize(folder_path) {
      const files = (await fs.promises.readdir(folder_path))
        .map(f => path.join(folder_path, f));

      let total = 0;
      for (const file of files) {
        const stat = await fs.promises.lstat(file);
        if (stat.isFile()) {
          const size = await getFileSize(file);
          total = total + size;
        }
      }
      return total;
    }

    async show(ctx) {
      const [ available_photo_list ] = await Promise.all([
        ctx.service.photo.getAvailablePhotoList(),
        this.getAllMemberList(ctx),
      ]);

      const { imageSavePath, imageThumbSavePath } = ctx.app.config;

      const [ src_storage, thumb_storage ] = (
        await Promise.all([
          this.calcFilesSize(imageSavePath),
          this.calcFilesSize(imageThumbSavePath),
        ])
      ).map(filesize);

      ctx.backData(200, {
        available_photo_count: available_photo_list.length,
        src_storage,
        thumb_storage,
      });
    }
  }
  return StatisticController;
};
