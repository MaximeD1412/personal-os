import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hlm } from './hlm';

const tokens = readFileSync(
  join(__dirname, '../../../../theme/tokens.css'),
  'utf8',
);
const niveaux = [...tokens.matchAll(/^\s*--text-([a-z]+(?:-[a-z]+)*):/gm)].map(
  ([, nom]) => nom,
);
const espacements = [
  ...tokens.matchAll(/^\s*--spacing-([a-z0-9-]+):/gm),
].map(([, nom]) => nom);
const icones = [...tokens.matchAll(/^@utility icon-([a-z0-9]+)/gm)].map(
  ([, nom]) => nom,
);

describe('hlm', () => {
  it("garde la taille de texte d'un jeton typographique à côté d'une couleur", () => {
    expect(hlm('text-body-dense text-on-primary').split(' ')).toEqual([
      'text-body-dense',
      'text-on-primary',
    ]);
  });

  it("connaît chaque niveau de l'échelle typographique de tokens.css", () => {
    expect(niveaux.length).toBeGreaterThanOrEqual(11);
    for (const niveau of niveaux) {
      expect(hlm(`text-sm text-${niveau} text-on-surface`)).toBe(
        `text-${niveau} text-on-surface`,
      );
    }
  });

  it("laisse la dernière taille d'icône gagner, pour chaque taille de tokens.css", () => {
    expect(icones.length).toBeGreaterThanOrEqual(5);
    for (const taille of icones) {
      expect(hlm(`icon-xl icon-${taille}`)).toBe(`icon-${taille}`);
    }
    expect(hlm('[&_ng-icon]:icon-sm [&_ng-icon]:icon-xs')).toBe(
      '[&_ng-icon]:icon-xs',
    );
  });

  it('laisse le dernier espacement pen gagner, pour chaque espacement de tokens.css', () => {
    expect(espacements.length).toBeGreaterThanOrEqual(10);
    for (const nom of espacements) {
      expect(hlm(`p-4 p-${nom}`)).toBe(`p-${nom}`);
      expect(hlm(`gap-space-xs gap-${nom}`)).toBe(`gap-${nom}`);
    }
  });
});
