import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MODELES_HORS_ESPACE,
  RELATIONS_VERS_ESPACE,
} from './modeles';

/**
 * La garde ne vaut que si la liste des modèles hors Espace décrit vraiment le
 * schéma. On la relit donc contre lui, plutôt que de la croire sur parole :
 * ajouter un modèle sans Espace devient un geste délibéré, et l'oublier fait
 * échouer la campagne au lieu de creuser un trou silencieux.
 */
describe('Modèles hors Espace', () => {
  const modeles = lireLesModeles();

  it('ne déclare que des modèles qui existent', () => {
    for (const nom of Object.keys(MODELES_HORS_ESPACE)) {
      expect(modeles.has(nom)).toBe(true);
    }
  });

  it("recense exactement les modèles qui ne portent pas de scopeId", () => {
    const sansEspace = [...modeles.entries()]
      .filter(([, champs]) => !champs.some((champ) => champ.nom === 'scopeId'))
      .map(([nom]) => nom);

    expect(sansEspace.sort()).toEqual(Object.keys(MODELES_HORS_ESPACE).sort());
  });

  it('recense toutes leurs relations vers un modèle cloisonné, même indirectes', () => {
    for (const [nom, declarees] of Object.entries(RELATIONS_VERS_ESPACE)) {
      const reelles = (modeles.get(nom) ?? [])
        .filter(({ type }) => atteintUnEspace(type, modeles, new Set()))
        .map(({ nom: champ }) => champ);

      expect(reelles.sort()).toEqual([...declarees].sort());
    }
  });

  it('déclare les mêmes modèles hors Espace dans les deux listes', () => {
    expect(Object.keys(RELATIONS_VERS_ESPACE).sort()).toEqual(
      Object.keys(MODELES_HORS_ESPACE).sort(),
    );
  });

  it('relie chaque modèle cloisonné à Scope', () => {
    for (const [nom, champs] of modeles) {
      if (nom in MODELES_HORS_ESPACE) {
        continue;
      }

      expect(champs).toEqual(
        expect.arrayContaining([{ nom: 'scopeId', type: 'String' }]),
      );
      expect(champs).toEqual(
        expect.arrayContaining([{ nom: 'scope', type: 'Scope' }]),
      );
    }
  });

  it("interdit qu'un modèle cloisonné en atteigne un autre", () => {
    // La garde vérifie l'Espace d'une charge écrite, pas celui des charges
    // imbriquées qu'elle contiendrait. Le jour où une Recette portera ses
    // Ingrédients, ce test échouera — et c'est là qu'il faudra étendre le
    // mécanisme, délibérément, plutôt que de le découvrir en production.
    for (const [nom, champs] of modeles) {
      if (nom in MODELES_HORS_ESPACE) {
        continue;
      }

      expect(
        champs.filter(({ type }) => cloisonne(type, modeles)).map((c) => c.nom),
      ).toEqual([]);
    }
  });
});

interface ChampPrisma {
  nom: string;
  type: string;
}

function cloisonne(type: string, modeles: Map<string, ChampPrisma[]>): boolean {
  return modeles.has(type) && !(type in MODELES_HORS_ESPACE);
}

function atteintUnEspace(
  type: string,
  modeles: Map<string, ChampPrisma[]>,
  visites: Set<string>,
): boolean {
  const champs = modeles.get(type);
  if (!champs) {
    return false;
  }
  if (champs.some((champ) => champ.nom === 'scopeId')) {
    return true;
  }
  if (visites.has(type)) {
    return false;
  }

  const suivantes = new Set(visites).add(type);
  return champs.some((champ) => atteintUnEspace(champ.type, modeles, suivantes));
}

function lireLesModeles(): Map<string, ChampPrisma[]> {
  const schema = readFileSync(
    resolve(__dirname, '../../../prisma/schema.prisma'),
    'utf8',
  );
  const modeles = new Map<string, ChampPrisma[]>();

  for (const bloc of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, nom, corps] = bloc;
    const champs: ChampPrisma[] = [];

    for (const ligne of corps.split('\n')) {
      const champ = /^\s{2}(\w+)\s+(\w+)/.exec(ligne);
      if (champ) {
        champs.push({ nom: champ[1], type: champ[2] });
      }
    }
    modeles.set(nom, champs);
  }

  return modeles;
}
