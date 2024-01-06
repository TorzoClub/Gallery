/* eslint valid-jsdoc: "off" */

'use strict';

const path = require('path');
const absolutePath = inputPath => path.join(__dirname, '../', inputPath);

const staticPath = absolutePath('./static');
const imageThumbSavePath = path.join(staticPath, './thumb/');
const imageSavePath = path.join(staticPath, './src/');

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // api 前缀，注意要以 / 结尾
  config.apiPrefix = '/';

  config.staticURLPrefix = 'http://127.0.0.1:7001';

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1570827005712_4094';

  // add your middleware config here
  config.middleware = [
    'backData',
    'errorHandler',
  ];

  config.static = {
    prefix: path.join(config.apiPrefix, './'),
    dir: staticPath,
  };
  const imagePath = path.join(config.static.prefix, 'src');
  const imageThumbPath = path.join(config.static.prefix, 'thumb');

  const popularly_formats = Object.freeze([ 'jpg', 'jpeg', 'png', 'gif' ]);
  const next_gen_formats = Object.freeze([ 'avif', 'webp' ]);
  const supported_formats = Object.freeze([ ...popularly_formats, ...next_gen_formats ]);

  config.multipart = {
    fieldNameSize: 256,
    fieldSize: '15MB',
    fields: 20,
    fileSize: '16MB',
    files: 1,

    // 为了保证文件上传的安全，框架限制了支持的文件格式。默认的后缀白名单参见源码。
    // 开发者可以通过配置 fileExtensions 来新增允许的类型：
    fileExtensions: [],

    // 如果希望覆盖框架内置的白名单，可以配置 whitelist 属性.当重写了 whitelist 时，fileExtensions 不生效。
    whitelist: supported_formats.map(format => `.${format}`),
  };

  config.development = {
    ...(config.development || {}),

    ignoreDirs: [
      imageThumbSavePath,
      imageSavePath,
    ],
  };

  // add your user config here
  const userConfig = {
    adminPass: '7355608',

    startBeforeGenerateThumb: false,

    default_image_thumb_size: 640,

    popularly_formats,
    next_gen_formats,
    supported_formats,

    imageThumbSavePath,
    imageSavePath,

    imagePath,
    imageThumbPath,
  };

  config.sequelize = {
    dialect: 'mysql', // support: mysql, mariadb, postgres, mssql
    database: 'torzo_photo',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: 'sqlpassword',

    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
    define: {
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      paranoid: false,
    },

    // delegate: 'myModel', // load all models to `app[delegate]` and `ctx[delegate]`, default to `model`
    // baseDir: 'my_model', // load all files in `app/${baseDir}` as models, default to `model`
    // exclude: 'index.js', // ignore `app/${baseDir}/index.js` when load models, support glob and array
    // more sequelize options
  };

  config.security = {
    domainWhiteList: [],
    csrf: {
      enable: false,
    },
  };

  return {
    ...config,
    ...userConfig,

    jwt: {
      secret: '233333',
      expiresIn: '12h',
    },
  };
};
