import { setCompodocJson } from '@storybook/addon-docs/angular';
import type { Preview } from '@storybook/angular';
import documentation from '../documentation.json';
import { theme } from './theme';

// Les entrées et sorties des composants, extraites par compodoc avant chaque
// lancement : la documentation et les contrôles en sont déduits.
setCompodocJson(documentation);

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    // La feuille globale du tableau de bord pose déjà le fond `surface` ;
    // le sélecteur de fond de Storybook ne propose que lui.
    backgrounds: {
      options: { surface: { name: 'surface', value: 'var(--surface)' } },
    },
    controls: { expanded: true },
    docs: { theme },
    options: {
      storySort: {
        order: ['Foundations', 'Actions', 'Forms', 'Data Display', 'Navigation', 'Feedback', 'Layout', 'Patterns'],
      },
    },
  },
  initialGlobals: { backgrounds: { value: 'surface' } },
};

export default preview;
