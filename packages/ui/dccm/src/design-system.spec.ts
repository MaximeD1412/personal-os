import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Un composant restylé aux jetons n'écrit ni couleur, ni taille de police, ni
// rayon en dur (docs/design-system.md, « Les règles ») : ni valeur
// arbitraire, ni échelle Tailwind par défaut, ni alias shadcn, ni alpha hors
// des pistes teintées.

const ui = join(__dirname, '../..');
const COMPOSANTS = [
  'avatar',
  'badge',
  'button',
  'card',
  'checkbox',
  'field',
  'input',
  'kbd',
  'label',
  'progress',
  'select',
  'separator',
  'switch',
  'table',
  'toggle-group',
  'dccm/src/kpi-tile',
  'dccm/src/list-row',
  'dccm/src/section-header',
  'dccm/src/stepper',
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

function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return sources(chemin);
    return /\.ts$/.test(entree.name) &&
      !/\.(spec|stories)\.ts$/.test(entree.name)
      ? [chemin]
      : [];
  });
}

describe('les composants du design system', () => {
  it.each(COMPOSANTS)('%s ne porte aucune valeur en dur', (composant) => {
    const fichiers = sources(join(ui, composant));
    expect(fichiers.length).toBeGreaterThan(0);
    const ecarts = fichiers.flatMap((fichier) =>
      readFileSync(fichier, 'utf8')
        .split('\n')
        .flatMap((ligne, i) =>
          INTERDITS.filter(([, motif]) => motif.test(ligne)).map(
            ([regle]) => `${fichier.slice(ui.length + 1)}:${i + 1} ${regle}`,
          ),
        ),
    );
    expect(ecarts).toEqual([]);
  });
});
