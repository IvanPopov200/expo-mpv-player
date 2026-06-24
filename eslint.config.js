const base = require('expo-module-scripts/eslint.config.base');

module.exports = [
  {
    ignores: ['build/', 'plugin/build/', 'node_modules/', 'example/'],
  },
  ...base,
];
