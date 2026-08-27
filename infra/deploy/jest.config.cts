module.exports = {
  displayName: 'deploy',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  // Les tests unitaires n'exécutent que des chemins sans effet de bord :
  // --dry-run, garde-fous, refus. Le déploiement réel, avec son registre, sa
  // répétition de migration et son retour arrière, est dans les tests
  // d'intégration.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.integration-spec\\.ts$'],
  coverageDirectory: '../../coverage/infra/deploy',
};
