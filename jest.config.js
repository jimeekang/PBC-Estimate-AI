/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        strict: false,
        esModuleInterop: true,
      },
    }],
  },
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(genkit|@genkit-ai)/)',
  ],
};

module.exports = config;
