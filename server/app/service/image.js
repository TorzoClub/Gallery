'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

function urlPathnameJoin(url, append_path) {
  const u = new URL(url);
  u.pathname = path.join(u.pathname, append_path);
  return u.toString();
}

const { Service } = require('egg');

module.exports = app =>
  class ImageService extends Service {
    static toSrcSavePath(filename) {
      return path.join(app.config.imageSavePath, filename);
    }

    static toSrcUrlPath(fileName) {
      return path.join(app.config.imagePath, fileName);
    }

    static toSrcUrl(src_filename) {
      return urlPathnameJoin(
        app.config.staticURLPrefix,
        ImageService.toSrcUrlPath(src_filename)
      );
    }

    static toThumbFilename(srcFileName) {
      const { name } = path.parse(srcFileName);
      return `${name}.jpg`;
    }

    static toThumbSavePath(src_filename) {
      return path.join(
        app.config.imageThumbSavePath,
        ImageService.toThumbFilename(
          src_filename
        )
      );
    }

    static toThumbUrlPath(src_filename) {
      return path.join(
        app.config.imageThumbPath,
        ImageService.toThumbFilename(
          src_filename
        )
      );
    }

    static toThumbUrl(src_filename) {
      return urlPathnameJoin(
        app.config.staticURLPrefix,
        ImageService.toThumbUrlPath(src_filename)
      );
    }

    static async generateThumb(
      src_filename,
      { thumb_size } = {
        thumb_size: app.config.imageThumbSize,
      }
    ) {
      const src_path = ImageService.toSrcSavePath(src_filename);
      const sharp_p = sharp(src_path);

      const writePath = ImageService.toThumbSavePath(src_filename);

      await sharp_p
        .rotate()
        .resize(thumb_size, null)
        .jpeg({
          quality: 60,
          trellisQuantisation: true,
          overshootDeringing: true,
        })
        .toFile(writePath);

      return {
        src_filename,
        thumbFilename: ImageService.toThumbFilename(src_filename),
      };
    }

    async generateThumbs(src_list, options) {
      const successes = [];
      const failures = [];
      for (const src of src_list) {
        try {
          await ImageService.generateThumb(src, options);
          successes.push(src);
        } catch (err) {
          failures.push(src);
        }
      }
      return [ successes, failures ];
    }

    async removeAllThumbs() {
      const src_list = fs.readdirSync(app.config.imageSavePath);
      src_list.forEach(src_filename => {
        const filepath = ImageService.toThumbSavePath(src_filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      });
    }

    async storeByFilePath(file_path) {
      const src_filename = `${Date.now()}${path.extname(file_path)}`;
      const writePath = ImageService.toSrcSavePath(src_filename);
      fs.cpSync(file_path, writePath);

      const { thumbFilename } = await ImageService.generateThumb(src_filename);

      return {
        imagePath: app.config.imagePath,
        imageThumbPath: app.config.imageThumbPath,
        src: src_filename,
        thumb: thumbFilename,
      };
    }

    async storeByStream(stream) {
      const src_filename = `${Date.now()}${path.extname(stream.filename)}`;
      const writePath = ImageService.toSrcSavePath(src_filename);
      const writeStream = fs.createWriteStream(writePath);

      await (new Promise((res, rej) => {
        stream.on('data', chunk => writeStream.write(chunk));
        stream.on('end', () => {
          writeStream.end(res);
        });
        stream.on('error', rej);
      }));

      const { thumbFilename } = await ImageService.generateThumb(src_filename);

      return {
        imagePath: app.config.imagePath,
        imageThumbPath: app.config.imageThumbPath,
        src: src_filename,
        thumb: thumbFilename,
      };
    }
  };
