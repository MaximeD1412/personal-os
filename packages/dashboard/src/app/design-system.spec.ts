import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Un écran composé avec le design system n'écrit ni couleur, ni taille de
// police, ni rayon en dur (docs/design-system.md, « Les règles ») : il ne
// prend que des jetons. Les motifs sont ceux qui gardent les composants
// (`packages/ui/dccm/src/design-system.spec.ts`).

const ECRANS = [
  'agenda.ts',
  'agenda.html',
  'calendrier.ts',
  'calendrier.html',
  'categories-d-evenement.ts',
  'formulaire-d-evenement.ts',
  'formulaire-d-evenement.html',
  'formulaire-d-occurrence.ts',
  'formulaire-d-occurrence.html',
  'modules-d-origine.ts',
  'saisie-de-recurrence.ts',
];

const INTERDITS: [string, RegExp][] = [
  ['couleur hexadécimale', /#[0-9a-f]{3,8}\b/i],
  ['taille de police Tailwind', /\btext-(xs|sm|base|lg|[2-9]?xl)\b/],
  ['valeur arbitraire de texte', /\btext-\[/],
  [
    'rayon arbitraire ou hors jetons',
    /\brounded(-[a-z]+)?-\[|\brounded-([2-4]?xl)\b/,
  ],
  [
    'couleur à alpha',
    /\b(bg|text|border|ring|fill|outline|stroke)-[a-z-]+\/\d+/,
  ],
  [
    'alias shadcn',
    /\b(bg|text|border|ring)-(muted|accent|popover|card|background|foreground|input|ring|destructive|sidebar)(-foreground)?\b/,
  ],
];

describe('les écrans composés avec le design system', () => {
  it.each(ECRANS)('%s ne porte aucune valeur en dur', (fichier) => {
    const ecarts = readFileSync(join(__dirname, fichier), 'utf8')
      .split('\n')
      .flatMap((ligne, i) =>
        INTERDITS.filter(([, motif]) => motif.test(ligne)).map(
          ([regle]) => `${fichier}:${i + 1} ${regle}`,
        ),
      );
    expect(ecarts).toEqual([]);
  });
});
