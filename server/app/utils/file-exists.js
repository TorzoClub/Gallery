'use strict';

const fs = require('fs');

module.exports = async function fileExists(filename) {
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
};
