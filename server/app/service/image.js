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

    static toThumbFilename(srcFileName) {
      return `${srcFileName}.jpg`;
    }

    static toLocalThumbPath(fileName) {
      return path.join(
        app.config.imageThumbSavePath,
        ImageService.toThumbFilename(fileName)
      );
    }

    static toSrcUrl(fileName) {
      return url.resolve(app.config.imagePrefix, fileName);
    }

    static toThumbUrl(fileName) {
      return url.resolve(
        app.config.imageThumbPrefix,
        ImageService.toThumbFilename(fileName)
      );
    }

    static async generateThumb(filePath) {
      const image = await jimp.read(filePath);

      const srcFilename = path.basename(filePath);
      const writePath = ImageService.toLocalThumbPath(srcFilename);

      await image
        .resize(app.config.imageThumbSize, jimp.AUTO)
        .quality(60)
        .write(writePath);

      return {
        srcFilename,
        thumbFilename: ImageService.toThumbFilename(srcFilename),
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

      const { thumbFilename } = await ImageService.generateThumb(writePath);

      return {
        imagePrefix: app.config.imagePrefix,
        imageThumbPrefix: app.config.imageThumbPrefix,
        src: saveFilename,
        thumb: thumbFilename,
      };
    }
  };
