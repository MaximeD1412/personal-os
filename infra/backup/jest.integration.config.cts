module.exports = {
  displayName: 'backup:integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/src/**/*.integration-spec.ts'],
  // Un va-et-vient complet initialise un dépôt, sauvegarde, restaure et
  // vérifie : c'est lent, et le rendre rapide reviendrait à ne plus rien
  // prouver.
  testTimeout: 180_000,
  maxWorkers: 1,
  coverageDirectory: '../../coverage/infra/backup-integration',
};
