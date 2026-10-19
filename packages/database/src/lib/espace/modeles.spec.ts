import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import {
  lireLeModeleDeDonnees,
  lireLeSchema,
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

  it('recense exactement les modèles qui ne portent pas de scopeId', () => {
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
        expect.arrayContaining([
          expect.objectContaining({ nom: 'scopeId', type: 'String' }),
        ]),
      );
      expect(champs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ nom: 'scope', type: 'Scope' }),
        ]),
      );
    }
  });

  it('lit du client Prisma les relations exactes du schéma', () => {
    // La garde suit les écritures imbriquées le long des relations que le
    // client déclare à l'exécution (ADR 0028) : elles doivent être celles du
    // schéma, toutes, sans liste tenue à la main.
    const client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: 'postgresql://jamais/ouverte',
      }),
    });
    const { relations } = lireLeSchema(lireLeModeleDeDonnees(client));

    const attendues = Object.fromEntries(
      [...modeles].map(([nom, champs]) => [
        nom,
        Object.fromEntries(
          champs
            .filter(({ type }) => modeles.has(type))
            .map(({ nom: champ, type }) => [champ, type]),
        ),
      ]),
    );
    expect(relations).toEqual(attendues);
  });

  it("fait porter l'Espace à la clé de chaque relation entre modèles cloisonnés", () => {
    // Une exception ne peut viser que l'Événement de son propre Espace : la
    // base le garantit, parce que la clé étrangère compare aussi scopeId. Une
    // ligne créée par son parent en tire donc l'Espace, que la garde n'a pas
    // à poser (ADR 0028).
    for (const [nom, champs] of modeles) {
      for (const { cle } of champs.filter(
        ({ type, cle }) => cloisonne(type, modeles) && cle !== null,
      )) {
        expect({ nom, cle }).toEqual({
          nom,
          cle: {
            fields: expect.arrayContaining(['scopeId']),
            references: expect.arrayContaining(['scopeId']),
          },
        });
      }
    }
  });
});

interface ChampPrisma {
  nom: string;
  type: string;
  /** La clé étrangère, du côté de la relation qui la porte. */
  cle: { fields: string[]; references: string[] } | null;
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
  return champs.some((champ) =>
    atteintUnEspace(champ.type, modeles, suivantes),
  );
}

function lireLaCle(ligne: string): ChampPrisma['cle'] {
  const liste = (attribut: string) =>
    new RegExp(`${attribut}:\\s*\\[([^\\]]*)\\]`)
      .exec(ligne)?.[1]
      .split(',')
      .map((nom) => nom.trim());
  const fields = liste('fields');
  const references = liste('references');

  return fields && references ? { fields, references } : null;
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
        champs.push({ nom: champ[1], type: champ[2], cle: lireLaCle(ligne) });
      }
    }
    modeles.set(nom, champs);
  }

  return modeles;
}
