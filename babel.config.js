module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@app': './app',
            '@features': './features',
            '@lib': './lib',
            '@locales': './locales',
          },
        },
      ],
    ],
  };
};
