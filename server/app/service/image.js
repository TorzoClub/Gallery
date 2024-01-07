'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

function urlPathnameJoin(url, append_path) {
  const u = new URL(url);
  u.pathname = path.join(u.pathname, append_path);
  return u.toString();
}

async function fileExists(filename) {
  try {
    await fs.promises.access(filename);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    } else {
      throw err;
    }
  }
}

const { Service } = require('egg');

module.exports = app =>
  class ImageService extends Service {
    static allFilename(src) {
      const src_without_ext = path.parse(src).name;
      return app.config.supported_formats.map(format => {
        return `${src_without_ext}.${format}`;
      });
    }

    static async removeSrc(src) {
      const file_list = ImageService.allFilename(src);
      const removed = [];
      for (const file of file_list) {
        const file_path = ImageService.toSrcSavePath(file);
        if (await fileExists(file_path)) {
          await fs.promises.unlink(file_path);
          removed.push(file_path);
        }
      }
      return removed;
    }

    static async removeThumb(thumb) {
      const file_list = ImageService.allFilename(thumb);
      const removed = [];
      for (const file of file_list) {
        const file_path = ImageService.toThumbSavePath(file);
        if (await fileExists(file_path)) {
          await fs.promises.unlink(file_path);
          removed.push(file_path);
        }
      }
      return removed;
    }

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

    static toDefaultThumbFilename(srcFileName) {
      const { name } = path.parse(srcFileName);
      return `${name}.jpg`;
    }

    static toDefaultThumbSavePath(src_filename) {
      return path.join(
        app.config.imageThumbSavePath,
        ImageService.toDefaultThumbFilename(
          src_filename
        )
      );
    }

    static toThumbSavePath(src_filename) {
      return path.join(
        app.config.imageThumbSavePath,
        src_filename
      );
    }

    static toDefaultThumbUrlPath(src_filename) {
      return path.join(
        app.config.imageThumbPath,
        ImageService.toDefaultThumbFilename(
          src_filename
        )
      );
    }

    static toDefaultThumbUrl(src_filename) {
      return urlPathnameJoin(
        app.config.staticURLPrefix,
        ImageService.toDefaultThumbUrlPath(src_filename)
      );
    }

    static async generateAnotherSrcByOptions({
      src_filename,
      format,
      extname = format,
      format_options,
    }) {
      const src_path = ImageService.toSrcSavePath(src_filename);
      const sharp_p = sharp(src_path);

      const another_src_filename = `${path.parse(src_path).name}.${extname}`;
      const writePath = ImageService.toSrcSavePath(another_src_filename);

      await sharp_p
        .rotate()
        .flatten({ background: '#FFFFFF' })
        [format]({ ...format_options })
        .toFile(writePath)
      ;

      return another_src_filename;
    }

    static async generateThumbByOptions({
      src_filename,
      thumb_size,
      format,
      extname = format,
      format_options,
    }) {
      const src_path = ImageService.toSrcSavePath(src_filename);
      const sharp_p = sharp(src_path);

      const thumb_filename = `${path.parse(src_path).name}.${extname}`;
      const writePath = ImageService.toThumbSavePath(thumb_filename);

      await sharp_p
        .rotate()
        .flatten({ background: '#FFFFFF' })
        .resize(thumb_size, null, { withoutEnlargement: true })
        [format]({ ...format_options })
        .toFile(writePath)
      ;

      return thumb_filename;
    }

    static async generateThumb(
      src_filename,
      { thumb_size } = {
        thumb_size: app.config.default_image_thumb_size,
      }
    ) {
      { // generate another format src files
        const src_ext = path.parse(src_filename).ext;
        if ((src_ext !== '.jpg') && (src_ext !== '.jpeg')) {
          await ImageService.generateAnotherSrcByOptions({
            src_filename,
            format: 'jpeg',
            extname: 'jpg',
            format_options: {
            },
          });
        }
        if (src_ext !== '.avif') {
          await ImageService.generateAnotherSrcByOptions({
            src_filename,
            format: 'avif',
            extname: 'avif',
            format_options: { },
          });
        }
        if (src_ext !== '.webp') {
          await ImageService.generateAnotherSrcByOptions({
            src_filename,
            format: 'webp',
            extname: 'webp',
            format_options: {
              smartSubsample: true,
              effort: 6,
            },
          });
        }
      }

      { // generate another thumb
        await ImageService.generateThumbByOptions({
          src_filename,
          thumb_size,
          format: 'avif',
          extname: 'avif',
          format_options: {
            quality: 40,
            effort: 8,
          },
        });

        await ImageService.generateThumbByOptions({
          src_filename,
          thumb_size,
          format: 'webp',
          extname: 'webp',
          format_options: {
            quality: 50,
            smartSubsample: true,
            effort: 6,
          },
        });
      }

      return {
        src_filename,
        thumbFilename: await ImageService.generateThumbByOptions({
          src_filename,
          thumb_size,
          format: 'jpeg',
          extname: 'jpg',
          format_options: {
            quality: 60,
            trellisQuantisation: true,
            overshootDeringing: true,
          },
        }),
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

    async storeByStream(stream, thumb_size) {
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

      const { thumbFilename } = await ImageService.generateThumb(
        src_filename,
        { thumb_size }
      );

      return {
        imagePath: app.config.imagePath,
        imageThumbPath: app.config.imageThumbPath,
        src: src_filename,
        thumb: thumbFilename,
      };
    }
  };
