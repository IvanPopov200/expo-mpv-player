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
// Resolve a single copy of React/React Native (the example's), even though the
// module under test is symlinked from the repo root.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
