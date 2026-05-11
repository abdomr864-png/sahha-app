module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-ignore': 'allow-with-description', minimumDescriptionLength: 10 },
    ],
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@features/*/!(index)*', '../../features/*'],
            message:
              'Cross-feature imports are forbidden. Import from features/shared/ instead.',
          },
        ],
      },
    ],
  },
  ignorePatterns: [
    'node_modules',
    '.expo',
    'android',
    'ios',
    'dist',
    'build',
    'coverage',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
    'jest-setup.ts',
  ],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: { 'max-lines': 'off' },
    },
  ],
};
