/* eslint valid-jsdoc: "off" */

'use strict';

const path = require('path');
const absolutePath = inputPath => path.join(__dirname, '../', inputPath);

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1570827005712_4094';

  // add your middleware config here
  config.middleware = [
    'backData',
    'errorHandler',
  ];

  config.static = {
    prefix: '/static/',
    dir: path.join(__dirname, '../static'),
  };

  // add your user config here
  const userConfig = {
    adminPass: '7355608',

    imageThumbSavePath: absolutePath('./static/thumb/'),
    imageSavePath: absolutePath('./static/src'),

    imageThumbPrefix: 'http://localhost:7001/static/thumb',
    imagePrefix: 'http://localhost:7001/static/src',
  };

  config.sequelize = {
    dialect: 'mysql', // support: mysql, mariadb, postgres, mssql
    database: 'torzo_photo',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: 'torzoBanzai',

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
    domainWhiteList: ['*','localhost:3000','http://localhost:3000','http://localhost:3000/'],
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
