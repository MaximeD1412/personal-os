import type { StorybookConfig } from '@storybook/angular';

// Un seul Storybook pour tout `packages/ui` : les composants spartan restylés
// comme ceux de `dccm` y ont leurs stories, rangées par catégorie de la
// bibliothèque pen.dev (Foundations, Actions, Forms…).
const config: StorybookConfig = {
  stories: ['../../**/*.stories.ts'],
  // `pseudo-states` force survol, focus et pression : les stories d'états
  // les montrent côte à côte, comme les galeries pen.dev.
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    'storybook-addon-pseudo-states',
  ],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
  },
};

export default config;
