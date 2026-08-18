module.exports = {
  displayName: 'deploy:integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/src/**/*.integration-spec.ts'],
  // Un déploiement complet construit deux images, les pousse dans un vrai
  // registre, restaure une sauvegarde, rejoue une migration et redémarre une
  // pile. C'est lent, et le rendre rapide reviendrait à ne plus rien prouver.
  testTimeout: 600_000,
  maxWorkers: 1,
  coverageDirectory: '../../coverage/infra/deploy-integration',
};
