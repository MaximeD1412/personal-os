import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// La garde d'Espace ne couvre ni le SQL brut ni un client Prisma nu (ADR 0028) :
// la config ESLint de l'API les refuse. ESLint tourne dans un processus à part,
// parce que sa config est un module ES que Jest ne charge pas.
const RACINE_API = join(__dirname, '..');
const MESSAGE =
  "SQL brut et client Prisma nu interdits dans l'API : la garde d'Espace ne les couvre pas (ADR 0028).";

interface Message {
  ruleId: string | null;
  message: string;
}

// Un seul processus pour tous les cas : charger ESLint et sa config coûte cher.
const LINTER = `
  import { ESLint } from 'eslint';
  const sources = JSON.parse(await new Response(process.stdin).text());
  const eslint = new ESLint();
  const resultats = [];
  for (const { source, filePath } of sources) {
    const [r] = await eslint.lintText(source, { filePath });
    resultats.push(r.messages.map(({ ruleId, message }) => ({ ruleId, message })));
  }
  process.stdout.write(JSON.stringify(resultats));
`;

interface Cas {
  source: string;
  filePath: string;
}

function linter(sources: Cas[]): Message[][] {
  const resultat = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', LINTER],
    { cwd: RACINE_API, input: JSON.stringify(sources), encoding: 'utf8' },
  );
  if (resultat.status !== 0) throw new Error(resultat.stderr);
  return JSON.parse(resultat.stdout);
}

const REPOSITORY = 'src/app/exemple/exemple.repository.ts';

const REFUSES: [string, string, string?][] = [
  ['$queryRaw en gabarit', 'export const f = (p: any) => p.$queryRaw`SELECT 1`;'],
  ['$queryRaw en appel', 'export const f = (p: any) => p.$queryRaw("SELECT 1");'],
  ['$queryRawUnsafe', 'export const f = (p: any) => p.$queryRawUnsafe("SELECT 1");'],
  ['$executeRaw', 'export const f = (p: any) => p.$executeRaw`DELETE FROM x`;'],
  ['$executeRawUnsafe', 'export const f = (p: any) => p.$executeRawUnsafe("DELETE");'],
  ['un accès calculé', 'export const f = (p: any) => p["$queryRaw"]`SELECT 1`;'],
  ['un accès par gabarit', 'export const f = (p: any) => p[`$queryRaw`]`SELECT 1`;'],
  ['une déstructuration', 'export const f = ({ $executeRaw }: any) => $executeRaw;'],
  ['une déstructuration à clé littérale', 'export const f = ({ "$queryRawUnsafe": sql }: any) => sql;'],
  ['une déstructuration à clé calculée', "export const f = ({ ['$queryRawUnsafe']: sql }: any) => sql;"],
  ['une déstructuration à clé gabarit', 'export const f = ({ [`$executeRaw`]: sql }: any) => sql;'],
  ['un import de @prisma/client', "import { PrismaClient } from '@prisma/client';\nexport const c = PrismaClient;"],
  ['un sous-chemin de @prisma/client', "import { Prisma } from '@prisma/client/runtime/library';\nexport const c = Prisma;"],
  ['un autre paquet @prisma', "import { PrismaPg } from '@prisma/adapter-pg';\nexport const c = PrismaPg;"],
  ['le client généré', "import { PrismaClient } from '../../../../database/src/generated/prisma/client';\nexport const c = PrismaClient;"],
  ['une réexportation', "export * from '@prisma/client';"],
  ['un import dynamique', "export const c = import('@prisma/client');"],
  ['un require', "export const c = require('@prisma/client');"],
  ['un import = require', "import P = require('@prisma/client');\nexport const c = P;"],
  ['un import de type', "export type T = import('@prisma/client').Prisma.Sql;"],
  ['un import dans un .cts', "import { PrismaClient } from '@prisma/client';\nexport const c = PrismaClient;", 'src/app/exemple/exemple.cts'],
  ['un import dans un .mts', "import { PrismaClient } from '@prisma/client';\nexport const c = PrismaClient;", 'src/app/exemple/exemple.mts'],
  ['du SQL brut dans un .cts', 'export const f = (p: any) => p.$queryRaw`SELECT 1`;', 'src/app/exemple/exemple.cts'],
  ['du SQL brut dans un .mts', 'export const f = (p: any) => p.$executeRaw`DELETE FROM x`;', 'src/app/exemple/exemple.mts'],
];

const FACADE = [
  "import { PrismaService } from '@personal-os/database';",
  'export const f = (p: PrismaService) => p.event.findMany({});',
].join('\n');

describe('règles de lint de l’API', () => {
  let refus: Message[][];

  beforeAll(() => {
    refus = linter([
      ...REFUSES.map(([, source, filePath = REPOSITORY]) => ({ source, filePath })),
      { source: FACADE, filePath: REPOSITORY },
    ]).map(
      (messages) => messages.filter((m) => m.message === MESSAGE),
    );
  }, 60_000);

  it.each(REFUSES.map(([cas], i) => [cas, i] as const))('refuse %s', (_cas, i) => {
    expect(refus[i]).toHaveLength(1);
  });

  it('laisse passer la façade de @personal-os/database', () => {
    expect(refus[REFUSES.length]).toEqual([]);
  });
});
