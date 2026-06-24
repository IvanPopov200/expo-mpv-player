// Metro config for the example app. Watches the parent package so changes to the
// module's source are picked up without reinstalling.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Avoid resolving two copies of React/React Native from the parent.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
