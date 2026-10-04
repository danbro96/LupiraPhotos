// expo/metro-config detects the npm workspace root itself (watchFolders + nodeModulesPaths),
// so the hoisted node_modules and packages/domain sources resolve without manual wiring.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
