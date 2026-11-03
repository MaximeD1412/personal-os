import { NgIcon, provideIcons } from '@ng-icons/core';
import { matTerminalOutline } from '@ng-icons/material-symbols/outline';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmTopBar } from './top-bar';

// Le master `TopBar`. La zone de recherche est vide tant que la barre de
// commande (CMD-3) ne la remplit pas ; le bouton de thème n'existe pas (sombre
// seul en V1).
const meta: Meta<DccmTopBar> = {
  title: 'Navigation/TopBar',
  component: DccmTopBar,
  decorators: [
    applicationConfig({ providers: [provideIcons({ matTerminalOutline })] }),
    moduleMetadata({ imports: [DccmTopBar, NgIcon] }),
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    scopes: [
      { value: 'perso', label: 'Mon espace' },
      { value: 'foyer', label: 'Foyer' },
    ],
    scope: 'perso',
    userName: 'Personne Admise',
  },
  render: (args) => ({
    props: args,
    template: `<dccm-top-bar [scopes]="scopes" [(scope)]="scope" [userName]="userName" />`,
  }),
};
export default meta;

type Story = StoryObj<DccmTopBar>;

export const Controles: Story = { name: 'Contrôles' };

/** Un compte qui n'atteint qu'un Espace : le sélecteur n'en propose qu'un. */
export const UnSeulEspace: Story = {
  name: 'Un seul Espace',
  args: { scopes: [{ value: 'perso', label: 'Mon espace' }] },
};

/** La zone projetée `[dccmTopBarSearch]`, que la barre de commande occupera. */
export const AvecRecherche: Story = {
  name: 'Avec zone de recherche',
  render: (args) => ({
    props: args,
    template: `
      <dccm-top-bar [scopes]="scopes" [(scope)]="scope" [userName]="userName">
        <button dccmTopBarSearch type="button"
          class="flex w-full max-w-144 items-center gap-space-sm rounded-md bg-surface-container-low px-space-md py-1 text-body-dense text-on-surface-variant">
          <ng-icon name="matTerminalOutline" class="icon-sm" aria-hidden="true" />
          Que veux-tu faire ?
        </button>
      </dccm-top-bar>
    `,
  }),
};
