module.exports = {
  displayName: 'database',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // L'accès aux données n'a pas de logique propre : il est exercé par les
  // tests d'intégration de l'API, sur base jetable.
  passWithNoTests: true,
  coverageDirectory: '../../coverage/packages/database',
};
