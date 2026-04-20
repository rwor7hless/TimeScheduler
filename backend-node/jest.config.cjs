/**
 * Jest config for the Nest backend port.
 *
 * `roots` picks up both src-colocated `*.spec.ts` (unit tests live next to the
 * code they cover) and `test/*.e2e-spec.ts` (integration tests that boot the
 * Nest app or hit the real DB).
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testTimeout: 15000,
};
