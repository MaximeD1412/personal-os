import {
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmCommandBarTrigger } from '../command-bar/command-bar';
import { DccmTopBar } from './top-bar';

// Le master `TopBar`. La zone de recherche reçoit le déclencheur de la barre
// de commande (`Navigation/CommandBar`) ; le bouton de thème n'existe pas
// (sombre seul en V1).
const meta: Meta<DccmTopBar> = {
  title: 'Navigation/TopBar',
  component: DccmTopBar,
  decorators: [
    moduleMetadata({ imports: [DccmTopBar, DccmCommandBarTrigger] }),
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

/** La zone projetée `[dccmTopBarSearch]` : le déclencheur de la barre de commande. */
export const AvecRecherche: Story = {
  name: 'Avec zone de recherche',
  render: (args) => ({
    props: args,
    template: `
      <dccm-top-bar [scopes]="scopes" [(scope)]="scope" [userName]="userName">
        <button dccmTopBarSearch dccmCommandBarTrigger label="Que veux-tu faire ?"></button>
      </dccm-top-bar>
    `,
  }),
};
