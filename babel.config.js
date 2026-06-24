// Used by babel-jest to transform React Native internals (Flow) and the TS
// layer during tests. `expo-module build` compiles the shipped package with tsc,
// so this config only affects the test run. The example app has its own config.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
