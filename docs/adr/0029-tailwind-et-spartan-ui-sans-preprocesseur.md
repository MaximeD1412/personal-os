# Tailwind et spartan/ui portent l'interface, sans préprocesseur

> **Statut :** accepté — 27 août 2026
> Remplace le CSS natif par composant posé en [#2](https://github.com/MaximeD1412/personal-os/issues/2),
> avant que d'autres écrans ne s'y ajoutent.

L'interface est écrite en **Tailwind CSS v4**, et les composants viennent de
**spartan/ui**, copiés dans `packages/ui`. Les jetons de thème vivent dans un
fichier unique, `packages/theme/tokens.css`, que les deux applications importent.

**shadcn/ui n'existe pas pour Angular** : c'est une bibliothèque React.
spartan/ui en est le portage — mêmes primitives accessibles, même palette, même
principe : le code des composants **nous appartient**, il est copié dans le
dépôt et se modifie, plutôt que consommé depuis un paquet.

**Il n'y a pas de préprocesseur.** Tailwind v4 est explicite sur ce point : il
n'est pas conçu pour cohabiter avec Sass, parce qu'il fait déjà le travail —
il bundle les `@import`, aplatit le nesting par Lightning CSS, pose les
préfixes, et repose sur les variables CSS natives. Ajouter SCSS par-dessus
n'apporterait que ses boucles et ses mixins, au prix d'un `@reference` en tête
de chaque feuille de composant : Angular les compile séparément, et `@apply`
n'y résout rien sans lui.

Trois règles en découlent :

- **Les jetons sont nommés par rôle, jamais par teinte** — `--primary`,
  `--muted-foreground`, `--destructive`. Un écran ne choisit pas une couleur,
  il choisit une intention ; c'est ce qui rend le mode sombre gratuit.
- **Un seul fichier de jetons pour les deux applications.** Deux copies
  dériveraient, et le système visuel ne serait plus un système. Une application
  qui doit s'en écarter redéfinit les jetons concernés après son import.
- **Les sources scannées sont nommées.** Tailwind part sinon du répertoire
  courant — la racine du dépôt, puisque Nx lance les cibles de là —, et
  ratisserait l'API et la base de données. `source(none)` coupe la détection
  automatique, deux `@source` la remplacent.

## Ce que cela coûte

- **Les `hlm-select` ne sont plus des `<select>` natifs.** Ce sont des
  surcouches CDK, et un test ne peut ni lire leur `.value` ni leur émettre un
  `change` : il ouvre et clique, comme le ferait quelqu'un. Le nécessaire est
  dans `packages/dashboard/src/testing/hlm-select.ts` plutôt que réécrit dans
  chaque campagne.
- **jsdom ne suffit plus seul.** `ResizeObserver`, `IntersectionObserver`,
  `matchMedia` et `scrollIntoView` sont doublés dans `test-setup.ts` : les
  primitives s'en servent pour se positionner, et sans eux le composant lève
  avant même d'être rendu. Aucun test ne porte sur la géométrie.
- **`packages/ui` est hors de prettier.** Les composants sont à nous, mais on
  les garde tels que le générateur les pose : les reformater ferait diverger
  chaque `nx g @spartan-ng/cli:ui` suivant.

## Options écartées

- **Tailwind v3 avec SCSS.** v3 cohabite mieux avec un préprocesseur, mais
  spartan/ui exige v4 (`tailwindcss >=4.0.0`). Choisir SCSS, c'était renoncer
  aux composants.
- **SCSS pour les seules feuilles de composant.** Techniquement possible : la
  feuille globale reste en CSS, les composants passent en `.scss`. On gagne les
  mixins, on paie un `@reference` par fichier et une compilation par fichier.
  Le jeu n'en vaut pas la chandelle tant qu'aucune règle ne réclame de boucle.
- **Un thème par application.** Le portfolio et le tableau de bord n'ont pas le
  même public, et l'idée de les laisser diverger se défend. Mais ils n'ont pas
  encore divergé, et deux fichiers identiques se désynchronisent toujours avant
  qu'on ne décide de les séparer.
- **Garder les `<select>` natifs, stylés en Tailwind.** Moins de risque et un
  meilleur comportement sur mobile. Écarté parce que c'était renoncer au seul
  composant que Tailwind seul ne sait pas rendre, et qu'il est au cœur des deux
  formulaires existants.
