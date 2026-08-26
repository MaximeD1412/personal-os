module.exports = {
  displayName: 'contracts',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // La bibliothèque ne porte que des types : ils sont vérifiés à la
  // compilation, et exercés par les tests de l'API et du tableau de bord.
  passWithNoTests: true,
  coverageDirectory: '../../coverage/packages/contracts'
};
