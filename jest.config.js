/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/src/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
  testPathIgnorePatterns: ["/node_modules/", "src/utils/encryption.test.ts"],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  moduleNameMapper: {
    '^nanoid$': require.resolve('nanoid'),
    '^file-type$': '<rootDir>/src/controllers/__tests__/__mocks__/file-type.ts',
  },
  forceExit: true,
};
