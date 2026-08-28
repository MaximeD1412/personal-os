import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Le critère de réussite de l'Agenda n'est pas ce qu'il affiche : c'est ce
 * qu'il ignore. « Ajouter un module qui doit apparaître à l'agenda ne modifie
 * pas l'agenda » (ADR 0011) ne tient que si aucun domaine n'entre ici.
 *
 * On le relit donc contre les fichiers eux-mêmes, comme la liste des modèles
 * hors Espace se relit contre le schéma : la garantie cesse d'être une
 * intention et devient une campagne qui échoue.
 */

/**
 * Ce que l'Agenda a le droit d'atteindre. Le port, par où les contributeurs se
 * présentent ; la portée d'Espace, qui n'est d'aucun domaine et que tout
 * contrôleur déclare (ADR 0028). Rien d'autre — et surtout aucun module qui
 * produirait des objets datés.
 */
const VOISINS_PERMIS = ['agenda-port', 'espace'];

const PAQUETS_PERMIS = ['@nestjs/', '@personal-os/contracts'];

/** Les fichiers de l'Agenda, sans les campagnes qui l'exercent. */
const FICHIERS = readdirSync(__dirname)
  .filter((nom) => nom.endsWith('.ts'))
  .filter((nom) => !nom.includes('spec'));

describe("L'Agenda ne connaît aucun domaine", () => {
  it('a bien des fichiers à examiner', () => {
    expect(FICHIERS).toContain('agenda.module.ts');
  });

  it.each(FICHIERS)("%s n'atteint que le port et la portée d'Espace", (nom) => {
    const voisins = importsDe(lire(nom))
      .filter((chemin) => chemin.startsWith('../'))
      .map((chemin) => chemin.split('/')[1]);

    expect(
      voisins.filter((voisin) => !VOISINS_PERMIS.includes(voisin)),
    ).toEqual([]);
  });

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
   * Le Calendrier alimente pourtant l'Agenda depuis la tranche où celui-ci
   * naît. Que son module n'apparaisse quand même pas ici est exactement ce
   * qu'on achète : le Sport et les Repas planifiés n'auront rien de plus à
   * demander.
   */
  it("n'assemble que le port, aucun module de domaine", () => {
    const declares = lire('agenda.module.ts').match(/imports:\s*\[([^\]]*)\]/);

    expect(declares?.[1].trim()).toBe('AgendaPortModule');
  });
});

function lire(nom: string): string {
  return readFileSync(join(__dirname, nom), 'utf8');
}

function importsDe(source: string): string[] {
  return [...source.matchAll(/from\s+'([^']+)'/g)].map(([, chemin]) => chemin);
}
