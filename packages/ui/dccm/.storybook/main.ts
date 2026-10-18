import type { StorybookConfig } from '@storybook/angular';

// Un seul Storybook pour tout `packages/ui` : les composants spartan restylés
// comme ceux de `dccm` y ont leurs stories, rangées par catégorie de la
// bibliothèque pen.dev (Foundations, Actions, Forms…).
const config: StorybookConfig = {
  stories: ['../../**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
  },
};

export default config;
