import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Le tableau de bord embarque ces schémas. `import { z }` y tire zod
      // en entier, toutes ses langues comprises (450 ko contre 85 ko) :
      // l'espace de noms seul laisse le bundler écarter ce qui ne sert pas.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='zod'] > :matches(ImportSpecifier[imported.name='z'], ImportDefaultSpecifier)",
          message:
            "Importer `* as z from 'zod'` : `{ z }` empêche le tree-shaking de zod dans le tableau de bord.",
        },
      ],
    },
  },
];
