import {
  matAddOutline,
  matFitnessCenterOutline,
  matRefreshOutline,
  matWifiOffOutline,
} from '@ng-icons/material-symbols/outline';
import { NgIcon } from '@ng-icons/core';
import { HlmButton } from '@personal-os/ui/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { DccmEmptyState } from './empty-state';

// Le master `EmptyState` de la planche `05 Feedback`, et l'`ErrorState` que
// la galerie en tire. Une seule action principale.

const meta: Meta<DccmEmptyState> = {
  title: 'Feedback/EmptyState',
  component: DccmEmptyState,
  decorators: [moduleMetadata({ imports: [HlmButton, NgIcon] })],
  args: {
    variant: 'empty',
    heading: 'Aucune séance cette semaine',
    description: 'Planifie une séance libre ou importe ton programme pour démarrer.',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['empty', 'error'] },
  },
  render: (args) => ({
    props: { ...args, icone: matFitnessCenterOutline, plus: matAddOutline },
    template: `
      <dccm-empty-state class="w-90" [variant]="variant" [heading]="heading" [description]="description" [icon]="icone">
        <button hlmBtn size="sm"><ng-icon [svg]="plus" />Planifier une séance</button>
      </dccm-empty-state>`,
  }),
};
export default meta;

type Story = StoryObj<DccmEmptyState>;

export const Controles: Story = { name: 'Contrôles' };

export const Galerie: Story = {
  name: 'Vide et erreur',
  parameters: { controls: { disable: true } },
  render: () => ({
    props: {
      seance: matFitnessCenterOutline,
      horsLigne: matWifiOffOutline,
      plus: matAddOutline,
      relancer: matRefreshOutline,
    },
    template: `
      <div class="flex flex-wrap items-start gap-gutter">
        <dccm-empty-state class="w-90" heading="Aucune séance cette semaine" description="Planifie une séance libre ou importe ton programme pour démarrer." [icon]="seance">
          <button hlmBtn size="sm"><ng-icon [svg]="plus" />Planifier une séance</button>
        </dccm-empty-state>
        <dccm-empty-state class="w-90" variant="error" heading="Le chargement a échoué" description="Le serveur n'a pas répondu." [icon]="horsLigne">
          <button hlmBtn variant="secondary" size="sm"><ng-icon [svg]="relancer" />Réessayer</button>
        </dccm-empty-state>
      </div>`,
  }),
};
