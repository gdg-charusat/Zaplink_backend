/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/src/tests/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    moduleNameMapper: {
        '^nanoid$': require.resolve('nanoid')
    },
    transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
    testPathIgnorePatterns: ["/node_modules/", "src/utils/encryption.test.ts"],
    forceExit: true,
    clearMocks: true,
    restoreMocks: true,
};
