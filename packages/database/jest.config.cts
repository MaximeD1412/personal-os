module.exports = {
  displayName: 'database',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testPathIgnorePatterns: ['\\.integration-spec\\.ts$'],
  passWithNoTests: true,
  coverageDirectory: '../../coverage/packages/database',
};
