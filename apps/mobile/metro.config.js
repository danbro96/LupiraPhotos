// expo/metro-config detects the npm workspace root itself (watchFolders + nodeModulesPaths),
// so the hoisted node_modules and packages/domain sources resolve without manual wiring.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
