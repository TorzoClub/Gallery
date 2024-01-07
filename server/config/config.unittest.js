/* eslint valid-jsdoc: "off" */

'use strict';

const path = require('path');
const absolutePath = inputPath => path.join(__dirname, '../', inputPath);

const staticPath = absolutePath('./test/static');
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

  config.development = {
    ...(config.development || {}),

    ignoreDirs: [
      imageThumbSavePath,
      imageSavePath,
    ],
  };

  config.logger = {
    level: 'DEBUG',
  };

  // add your user config here
  const userConfig = {
    adminPass: '7355608',

    startBeforeGenerateThumb: false,

    thumbSize: 640,

    imageThumbSavePath,
    imageSavePath,

    imagePath,
    imageThumbPath,
  };

  config.sequelize = {
    dialect: 'mysql', // support: mysql, mariadb, postgres, mssql
    database: 'torzo_photo_test',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: 'vechk123',

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
    domainWhiteList: [ 'http://localhost:3000/', 'http://localhost:9528' ],
    // csrf: {
    //   enable: true,
    // },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
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
