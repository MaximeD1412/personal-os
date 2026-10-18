import { NgIcon, provideIcons } from '@ng-icons/core';
import { matMoreVertOutline } from '@ng-icons/material-symbols/outline';
import { HlmBadge } from '@personal-os/ui/badge';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmListRow } from './list-row';

// Le master `ListRow`. L'élément qui le porte dit son usage : `<a dccmListRow>`
// mène au détail, `<button dccmListRow>` agit, `<dccm-list-row checkable>`
// porte une case à cocher (un article de courses, une tâche).
const meta: Meta<DccmListRow> = {
  title: 'Data Display/ListRow',
  component: DccmListRow,
  decorators: [
    applicationConfig({ providers: [provideIcons({ matMoreVertOutline })] }),
    moduleMetadata({ imports: [DccmListRow, HlmBadge, NgIcon] }),
  ],
  args: {
    label: 'Œufs bio plein air',
    meta: 'Réfrigérateur • 6 unités',
    checkable: true,
    checked: false,
    selected: false,
    chevron: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <dccm-list-row class="w-90" [label]="label" [meta]="meta" [checkable]="checkable"
        [(checked)]="checked" [selected]="selected" [chevron]="chevron">
        <span hlmBadge tone="success">DLC J+8</span>
      </dccm-list-row>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmListRow>;

/** La case se coche à la souris (case ou titre) et au clavier (Tab, puis Espace). */
export const Controles: Story = { name: 'Contrôles' };

/** Les états de la galerie : repos, survol (forcé ici), cochée, sélectionnée, sans case. */
export const Etats: Story = {
  name: 'États',
  render: () => ({
    template: `
      <div class="flex w-90 flex-col gap-space-md">
        <dccm-list-row label="Œufs bio plein air" meta="Réfrigérateur • 6 unités" checkable chevron>
          <span hlmBadge tone="success">DLC J+8</span>
        </dccm-list-row>
        <dccm-list-row class="bg-surface-container-high" label="Survol" meta="Réfrigérateur • 6 unités" checkable chevron>
          <span hlmBadge tone="success">DLC J+8</span>
        </dccm-list-row>
        <dccm-list-row label="Cochée" meta="Réfrigérateur • 6 unités" checkable [checked]="true" chevron>
          <span hlmBadge tone="success">DLC J+8</span>
        </dccm-list-row>
        <dccm-list-row label="Sélectionnée" meta="Réfrigérateur • 6 unités" checkable selected chevron>
          <span hlmBadge tone="success">DLC J+8</span>
        </dccm-list-row>
        <dccm-list-row label="Sans case ni chevron" meta="Réfrigérateur • 6 unités">
          <span hlmBadge tone="success">DLC J+8</span>
        </dccm-list-row>
      </div>
    `,
  }),
};

/** Une liste de liens vers le détail : le chevron le dit, la ligne courante est sélectionnée. */
export const Liens: Story = {
  render: () => ({
    template: `
      <nav aria-label="Recettes" class="w-90">
        <ul class="flex flex-col gap-space-xs">
          <li><a dccmListRow href="#" label="Poulet basquaise" meta="45 min • 4 parts" chevron selected aria-current="page"></a></li>
          <li><a dccmListRow href="#" label="Gratin dauphinois" meta="1 h 10 • 6 parts" chevron></a></li>
          <li><a dccmListRow href="#" label="Salade niçoise" meta="20 min • 2 parts" chevron>
            <span hlmBadge variant="tag">Été</span></a></li>
        </ul>
      </nav>
    `,
  }),
};

/** Une ligne qui agit (ouvre un panneau, choisit un élément) : un bouton. */
export const Bouton: Story = {
  render: () => ({
    template: `
      <button dccmListRow type="button" class="w-90" label="Crème fraîche épaisse" meta="Frigo • 180 g">
        <span hlmBadge tone="warning">Périme J-2</span>
      </button>
    `,
  }),
};
