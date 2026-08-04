module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Les tests unitaires ne touchent aucune infrastructure : les tests
  // d'intégration ont leur propre configuration.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.integration-spec\\.ts$'],
  coverageDirectory: '../../coverage/packages/api',
};
