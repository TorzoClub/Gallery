'use strict';

const fs = require('fs');
const path = require('path');

module.exports = {
  schedule: {
    cron: '0 0 0 */1 * *', // 每天执行一次
    type: 'worker',
  },

  async task(ctx) {
    const [ available_photo_list, member_list ] = await Promise.all([
      ctx.service.photo.getAvailablePhotoList(),
      ctx.model.Member.findAll({}),
    ]);

    const used_src_list = [
      ...available_photo_list.map(p => p.src),
      ...member_list.map(m => m.avatar_src),
    ].map(f => path.parse(f).name);

    const { imageSavePath, imageThumbSavePath } = ctx.app.config;

    const file_list = [
      ...fs.readdirSync(imageSavePath).map(f => path.join(imageSavePath, f)),
      ...fs.readdirSync(imageThumbSavePath).map(f => path.join(imageThumbSavePath, f)),
    ];

    for (const file of file_list) {
      const { name: file_name, ext } = path.parse(file);
      const is_used = used_src_list.includes(file_name);
      if (!is_used) {
        if (fs.lstatSync(file).isFile()) {
          ctx.app.logger.info(`auto clean used image: ${file_name}${ext}`);
          fs.unlinkSync(file);
        }
      }
    }
  },
};
