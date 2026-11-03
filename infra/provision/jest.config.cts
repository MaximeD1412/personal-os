module.exports = {
  displayName: 'provision',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  // Le script écrit sous une racine factice (--root) et journalise les
  // commandes système au lieu de les lancer. Le passage réel, deux fois de
  // suite sur une machine jetable, est le job « Provisionnement » de la CI
  // (e2e.sh).
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  // Chaque cas lance le script pour de vrai, parfois trois fois.
  testTimeout: 30000,
  coverageDirectory: '../../coverage/infra/provision',
};
