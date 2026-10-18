import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `tokens.css` recopie la bibliothèque pen.dev : ces tests la relisent et
// vérifient que rien n'a dérivé, nom par nom, valeur par valeur.

const racine = join(__dirname, '../..');
const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');

type Variable = { type: string; value: string | number };
const bibliotheque = JSON.parse(lire('design/personalos.lib.pen')) as {
  variables: Record<string, Variable>;
};

const registre = JSON.parse(lire('design/design-system.json')) as {
  tokens: { tints: Record<string, string> };
};

/**
 * Le frontmatter de DESIGN.md, sur deux niveaux (`section > clé > valeur` ou
 * `section > jeton > propriété > valeur`) : assez pour ce qu'on y lit.
 */
function lireFrontmatter(markdown: string) {
  const resultat: Record<
    string,
    Record<string, string & Record<string, string>>
  > = {};
  const lignes = markdown.split('---')[1].split('\n');
  let section = '';
  let cle = '';
  for (const ligne of lignes) {
    const [, indentation, nom, valeur] =
      ligne.match(/^( *)([\w-]+):\s*(.*)$/) ?? [];
    if (nom === undefined) continue;
    const propre = valeur.replace(/^'|'$/g, '');
    if (indentation.length === 0) resultat[(section = nom)] = {};
    else if (indentation.length === 2) {
      cle = nom;
      resultat[section][cle] = (propre || {}) as string &
        Record<string, string>;
    } else resultat[section][cle][nom] = propre;
  }
  return resultat;
}
const frontmatter = lireFrontmatter(lire('design/DESIGN.md'));
const remEnPx = (rem: string) => parseFloat(rem) * 16;

const tokens = lire('packages/theme/tokens.css').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Le contenu du premier bloc `{ … }` qui suit `entete`, accolades équilibrées. */
function bloc(css: string, entete: string): string {
  const debut = css.indexOf(entete);
  if (debut < 0) throw new Error(`Bloc introuvable : ${entete}`);
  const ouverture = css.indexOf('{', debut);
  let profondeur = 0;
  for (let i = ouverture; i < css.length; i++) {
    if (css[i] === '{') profondeur++;
    if (css[i] === '}' && --profondeur === 0)
      return css.slice(ouverture + 1, i);
  }
  throw new Error(`Bloc non fermé : ${entete}`);
}

/** Les propriétés personnalisées déclarées dans un bloc, normalisées. */
function declarations(contenu: string): Map<string, string> {
  const resultat = new Map<string, string>();
  for (const [, nom, valeur] of contenu.matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g,
  )) {
    resultat.set(nom, valeur.replace(/\s+/g, ' ').trim());
  }
  return resultat;
}

const racineCss = declarations(bloc(tokens, ':root'));

const variablesDeType = (type: string) =>
  Object.entries(bibliotheque.variables).filter(([, v]) => v.type === type);

describe('tokens.css', () => {
  it('porte les 43 couleurs de la bibliothèque pen.dev, sous leurs noms et valeurs', () => {
    const couleurs = variablesDeType('color');
    expect(couleurs).toHaveLength(43);
    for (const [nom, { value }] of couleurs) {
      expect([nom, racineCss.get(`--${nom}`)]).toEqual([nom, value]);
    }
  });

  it('porte les 8 pistes teintées de design-system.json', () => {
    const { tints } = registre.tokens;
    expect(Object.keys(tints)).toHaveLength(8);
    for (const [nom, valeur] of Object.entries(tints)) {
      expect([nom, racineCss.get(`--${nom}`)]).toEqual([nom, valeur]);
    }
  });

  it('porte les espacements et les rayons de la bibliothèque, en pixels', () => {
    const nombres = variablesDeType('number');
    expect(nombres.map(([nom]) => nom)).toEqual(
      expect.arrayContaining([
        'space-xs',
        'space-2xl',
        'gutter',
        'margin',
        'radius',
        'radius-full',
      ]),
    );
    for (const [nom, { value }] of nombres) {
      expect([nom, racineCss.get(`--${nom}`)]).toEqual([nom, `${value}px`]);
    }
    // Les deux espacements mobiles ne sont que dans le frontmatter de DESIGN.md.
    expect(racineCss.get('--gutter-compact')).toBe(
      `${remEnPx(frontmatter['spacing']['gutter-compact'])}px`,
    );
    expect(racineCss.get('--margin-mobile')).toBe(
      `${remEnPx(frontmatter['spacing']['margin-mobile'])}px`,
    );
  });

  it("porte l'échelle typographique : la planche Foundations, et l'interligne de DESIGN.md", () => {
    const echelle = specimensTypographiques();
    expect(Object.keys(echelle)).toHaveLength(11);
    const theme = declarations(bloc(tokens, '@theme static'));
    for (const [nom, specimen] of Object.entries(echelle)) {
      const attendu = {
        taille: `${specimen.fontSize}px`,
        graisse: specimen.fontWeight === 'normal' ? '400' : specimen.fontWeight,
        approche: specimen.letterSpacing
          ? `${specimen.letterSpacing}px`
          : undefined,
        interligne: frontmatter['typography'][nom]['lineHeight'],
      };
      expect([
        nom,
        {
          taille: theme.get(`--text-${nom}`),
          graisse: theme.get(`--text-${nom}--font-weight`),
          approche: theme.get(`--text-${nom}--letter-spacing`),
          interligne: theme.get(`--text-${nom}--line-height`),
        },
      ]).toEqual([nom, attendu]);
    }
  });

  it('expose chaque couleur, piste et espacement à Tailwind', () => {
    const theme = declarations(bloc(tokens, '@theme inline'));
    const couleurs = [
      ...variablesDeType('color').map(([nom]) => nom),
      ...Object.keys(registre.tokens.tints),
    ];
    for (const nom of couleurs) {
      expect([nom, theme.get(`--color-${nom}`)]).toEqual([
        nom,
        `var(--${nom})`,
      ]);
    }
    for (const nom of [
      'space-xs',
      'space-2xl',
      'gutter',
      'gutter-compact',
      'margin',
      'margin-mobile',
    ]) {
      expect([nom, theme.get(`--spacing-${nom}`)]).toEqual([
        nom,
        `var(--${nom})`,
      ]);
    }
    for (const nom of [
      'radius',
      'radius-sm',
      'radius-md',
      'radius-lg',
      'font-body',
      'font-mono',
      'shadow-popover',
    ]) {
      expect([nom, theme.get(`--${nom}`)]).toEqual([nom, `var(--${nom})`]);
    }
  });

  it('redirige les alias attendus par spartan vers les jetons pen', () => {
    const alias = {
      background: 'surface',
      foreground: 'on-surface',
      card: 'surface-container',
      'card-foreground': 'on-surface',
      popover: 'surface-container-high',
      'popover-foreground': 'on-surface',
      'primary-foreground': 'on-primary',
      'secondary-foreground': 'on-secondary',
      muted: 'surface-container-high',
      'muted-foreground': 'outline',
      accent: 'surface-container-high',
      'accent-foreground': 'on-surface',
      destructive: 'error',
      border: 'surface-container-highest',
      input: 'surface-container-highest',
      ring: 'primary',
      sidebar: 'surface-container-lowest',
      'sidebar-foreground': 'on-surface-variant',
      'sidebar-primary': 'primary',
      'font-sans': 'font-body',
    };
    for (const [nom, cible] of Object.entries(alias)) {
      expect([nom, racineCss.get(`--${nom}`)]).toEqual([
        nom,
        `var(--${cible})`,
      ]);
    }
  });

  it("n'a qu'un thème, sombre", () => {
    expect(racineCss.get('color-scheme')).toBeUndefined();
    expect(bloc(tokens, ':root')).toMatch(/color-scheme:\s*dark;/);
    expect(tokens).not.toMatch(/\.dark\b/);
  });
});

describe('les polices', () => {
  const polices = [
    'node_modules/@fontsource-variable/inter/index.css',
    'node_modules/@fontsource-variable/jetbrains-mono/index.css',
  ];
  const styles = (projet: string, cible: string): string[] =>
    JSON.parse(lire(`packages/${projet}/project.json`)).targets[cible].options
      .styles;

  it.each([
    ['dashboard', 'build', 'packages/dashboard/src/styles.css'],
    ['portfolio', 'build', 'packages/portfolio/src/styles.css'],
    ['ui/dccm', 'storybook', 'packages/dashboard/src/styles.css'],
    ['ui/dccm', 'build-storybook', 'packages/dashboard/src/styles.css'],
  ])(
    '%s:%s charge Inter et JetBrains Mono avant la feuille globale',
    (projet, cible, feuille) => {
      expect(styles(projet, cible)).toEqual([...polices, feuille]);
    },
  );

  it.each(['dashboard', 'portfolio'])(
    'la feuille globale de %s ne charge rien depuis un CDN',
    (application) => {
      const feuille = lire(`packages/${application}/src/styles.css`);
      expect(feuille).toMatch(/@import '\.\.\/\.\.\/theme\/tokens\.css';/);
      expect(feuille).not.toMatch(/https?:\/\//);
    },
  );
});

type Specimen = {
  fontSize: number;
  fontWeight: string;
  letterSpacing?: number;
};

/** Les spécimens `Type <jeton>` de la planche `Design System / 00 Foundations`. */
function specimensTypographiques(): Record<string, Specimen> {
  type Noeud = { name?: string; children?: Noeud[] } & Partial<Specimen>;
  const resultat: Record<string, Specimen> = {};
  const parcourir = (noeud: Noeud) => {
    const [, jeton] = noeud.name?.match(/^Type ([\w-]+)$/) ?? [];
    const specimen = noeud.children?.find((enfant) => enfant.name === 'Sample');
    if (jeton && specimen) resultat[jeton] = specimen as Specimen;
    noeud.children?.forEach(parcourir);
  };
  const planches = (bibliotheque as unknown as { children: Noeud[] }).children;
  const foundations = planches.find(
    (planche) => planche.name === 'Design System / 00 Foundations',
  );
  if (!foundations) throw new Error('Planche Foundations introuvable');
  parcourir(foundations);
  return resultat;
}
