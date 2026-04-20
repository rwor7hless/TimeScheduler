module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    // Separate tsconfig that includes test/ and jest.setup.ts so eslint's
    // type-aware rules can read them. The runtime build (nest build) still
    // uses the narrower tsconfig.json + tsconfig.build.json.
    project: './tsconfig.eslint.json',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '.eslintrc.cjs', 'scripts/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
