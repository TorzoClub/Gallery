'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');
const jimp = require('jimp');

const { Service } = require('egg');

module.exports = app =>
  class ImageService extends Service {
    static toLocalSrcPath(fileName) {
      return path.join(app.config.imageSavePath, fileName);
    }

    static toLocalThumbPath(fileName) {
      return path.join(app.config.imageThumbSavePath, fileName);
    }

    static toSrcUrl(fileName) {
      return url.resolve(app.config.imagePrefix, fileName);
    }

    static toThumbUrl(fileName) {
      return url.resolve(app.config.imageThumbPrefix, fileName);
    }

    async generateThumb(filePath) {
      const image = await jimp.read(filePath);

      await image.resize(150, jimp.AUTO);

      const srcFilename = path.basename(filePath);

      const writePath = ImageService.toLocalThumbPath(srcFilename);

      await image.writeAsync(writePath);

      return {
        filename: srcFilename,
      };
    }

    async storeWithStream(stream) {
      const saveFilename = `${Date.now()}${path.extname(stream.filename)}`;
      const writePath = ImageService.toLocalSrcPath(saveFilename);
      const writeStream = fs.createWriteStream(writePath);

      await (new Promise((res, rej) => {
        stream.pipe(writeStream);
        stream.on('end', () => {
          res();
        });
        stream.on('error', rej);
      }));

      const { filename: thumbFilename } = await this.generateThumb(writePath);

      return {
        imagePrefix: app.config.imagePrefix,
        imageThumbPrefix: app.config.imageThumbPrefix,
        src: saveFilename,
        thumb: thumbFilename,
      };
    }
  };
