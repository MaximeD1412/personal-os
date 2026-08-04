module.exports = {
  displayName: 'backup',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  // Les tests unitaires n'exécutent que des chemins sans effet de bord :
  // --dry-run, garde-fous, refus. Le va-et-vient réel avec Restic est dans les
  // tests d'intégration.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.integration-spec\\.ts$'],
  coverageDirectory: '../../coverage/infra/backup',
};
