const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Force CJS resolution so packages like zustand v5 don't ship their ESM build
// (which contains untransformed `import.meta.env`) into the web bundle, where
// it would be parsed as a classic <script> and throw SyntaxError.
config.resolver.unstable_conditionNames = ['require', 'react-native'];

module.exports = withNativeWind(config, { input: './global.css' });
