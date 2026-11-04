import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * « Ajouter un résumeur ne modifie pas le module `dashboard` » ne tient que si
 * aucun domaine n'entre ici (ADR 0011). On le relit donc contre les fichiers
 * eux-mêmes, comme l'Agenda : la garantie devient une campagne qui échoue.
 */

/**
 * Ce que le tableau de bord a le droit d'atteindre : son port, par où les
 * modules se résument, et la portée d'Espace, que tout contrôleur déclare
 * (ADR 0028). Rien d'autre.
 */
const VOISINS_PERMIS = ['dashboard-port', 'espace'];

/** Nest, les contrats partagés, et `nestjs-zod` : aucun n'est un domaine. */
const PAQUETS_PERMIS = ['@nestjs/', '@personal-os/contracts', 'nestjs-zod'];

/** Les fichiers du tableau de bord, sans les campagnes qui l'exercent. */
const FICHIERS = readdirSync(__dirname)
  .filter((nom) => nom.endsWith('.ts'))
  .filter((nom) => !nom.includes('spec'));

/** Les modules qui se résument au tableau de bord, et dont il ne dit pas le nom. */
const MODULES_RESUMES = ['food', 'calendar', 'training'];

describe('Le tableau de bord ne connaît aucun module', () => {
  it('a bien des fichiers à examiner', () => {
    expect(FICHIERS).toEqual(
      expect.arrayContaining(['dashboard.module.ts', 'a-faire.ts']),
    );
  });

  it.each(FICHIERS)(
    "%s n'atteint que son port et la portée d'Espace",
    (nom) => {
      const voisins = importsDe(lire(nom))
        .filter((chemin) => chemin.startsWith('../'))
        .map((chemin) => chemin.split('/')[1]);

      expect(
        voisins.filter((voisin) => !VOISINS_PERMIS.includes(voisin)),
      ).toEqual([]);
    },
  );

  it.each(FICHIERS)(
    "%s ne tire d'ailleurs que Nest et les contrats partagés",
    (nom) => {
      const paquets = importsDe(lire(nom)).filter(
        (chemin) => !chemin.startsWith('.'),
      );

      expect(
        paquets.filter(
          (paquet) =>
            !PAQUETS_PERMIS.some((permis) => paquet.startsWith(permis)),
        ),
      ).toEqual([]);
    },
  );

  /*
   * Un lien vers un écran, un cas de signal : rien de ce qui est propre à un
   * module ne s'écrit ici. Le jour où le Sport se résumera, il n'aura rien à
   * demander de plus que la Cuisine ou le Calendrier.
   */
  it.each(FICHIERS)("%s ne nomme aucun module, ni l'un de ses cas", (nom) => {
    const source = lire(nom);

    expect(
      MODULES_RESUMES.filter((module) =>
        new RegExp(`['\`/]${module}[./'\`]`).test(source),
      ),
    ).toEqual([]);
  });

  it("n'assemble que son port, aucun module de domaine", () => {
    const declares = lire('dashboard.module.ts').match(
      /imports:\s*\[([^\]]*)\]/,
    );

    expect(declares?.[1].trim()).toBe('DashboardPortModule');
  });
});

function lire(nom: string): string {
  return readFileSync(join(__dirname, nom), 'utf8');
}

function importsDe(source: string): string[] {
  return [...source.matchAll(/from\s+'([^']+)'/g)].map(([, chemin]) => chemin);
}
