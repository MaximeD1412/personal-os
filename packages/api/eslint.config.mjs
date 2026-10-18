import baseConfig from '../../eslint.config.mjs';

// La garde d'Espace ne couvre ni le SQL brut ni un client Prisma nu (ADR 0028).
// Aucune exception dans l'API : un besoin réel passe par un accès technique
// dédié dans packages/database, décidé par ADR.
const message =
  "SQL brut et client Prisma nu interdits dans l'API : la garde d'Espace ne les couvre pas (ADR 0028).";

const sqlBrut = '/^\\$(query|execute)Raw(Unsafe)?$/';
// Tout paquet @prisma/*, et le client généré de packages/database atteint par
// un chemin relatif. esquery n'accepte pas de « / » dans une regex : \W le remplace.
const clientNu = '/^@prisma\\W|generated\\Wprisma/';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          `MemberExpression[property.name=${sqlBrut}]`,
          `MemberExpression[property.value=${sqlBrut}]`,
          `ObjectPattern > Property[key.name=${sqlBrut}]`,
          `ImportDeclaration[source.value=${clientNu}]`,
          `ExportNamedDeclaration[source.value=${clientNu}]`,
          `ExportAllDeclaration[source.value=${clientNu}]`,
          `ImportExpression[source.value=${clientNu}]`,
          `CallExpression[callee.name='require'][arguments.0.value=${clientNu}]`,
          `TSExternalModuleReference[expression.value=${clientNu}]`,
          `TSImportType[argument.literal.value=${clientNu}]`,
        ].map((selector) => ({ selector, message })),
      ],
    },
  },
];
