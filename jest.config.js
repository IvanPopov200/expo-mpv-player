// Single-project (iOS/native resolution) preset for the TS layer. Mirrors what
// expo-module-scripts' multi-project preset does per platform, but runs once so
// platform-specific tests don't re-run under web/node resolution. The
// config-plugin suite runs separately under the node preset via `test:plugin`.
const createJestPreset = require('./node_modules/expo-module-scripts/createJestPreset.cjs');

module.exports = createJestPreset(require('jest-expo/ios/jest-preset'));
