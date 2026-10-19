import { NgIcon } from '@ng-icons/core';
import {
  matAddOutline,
  matFitnessCenterOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmButton } from '@personal-os/ui/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { DccmState } from './state';

// Les états d'un écran qui lit des données : chargement (squelette à la forme
// du contenu attendu), vide (et son action), erreur (le `message` de l'API et
// « Réessayer »), puis le contenu.

const meta: Meta<DccmState> = {
  title: 'Patterns/State',
  component: DccmState,
  decorators: [moduleMetadata({ imports: [HlmButton, NgIcon] })],
  args: {
    status: 'loading',
    skeleton: 'list',
    rows: 3,
    emptyHeading: 'Aucune séance cette semaine',
    emptyDescription: 'Ton planning d’entraînement de la semaine 23 ne contient aucune séance.',
    error: { message: "Le serveur n'a pas répondu." },
  },
  argTypes: {
    status: {
      control: 'inline-radio',
      options: ['loading', 'empty', 'error', 'ready'],
    },
    skeleton: { control: 'inline-radio', options: ['list', 'cards', 'detail'] },
  },
  render: (args) => ({
    props: { ...args, seance: matFitnessCenterOutline, plus: matAddOutline },
    template: `
      <dccm-state class="block max-w-90" [status]="status" [skeleton]="skeleton" [rows]="rows" [error]="error"
        [emptyHeading]="emptyHeading" [emptyDescription]="emptyDescription" [emptyIcon]="seance">
        <button dccmStateEmpty hlmBtn size="sm"><ng-icon [svg]="plus" />Nouvelle séance</button>
        <p class="text-body-default text-on-surface">Trois séances cette semaine.</p>
      </dccm-state>`,
  }),
};
export default meta;

type Story = StoryObj<DccmState>;

export const Controles: Story = { name: 'Contrôles' };

/** Les trois états côte à côte, comme l'écran « Motifs transverses ». */
export const Galerie: Story = {
  name: 'Chargement, vide, erreur',
  parameters: { controls: { disable: true } },
  render: () => ({
    props: {
      seance: matFitnessCenterOutline,
      plus: matAddOutline,
      erreur: { message: "Le serveur n'a pas répondu." },
    },
    template: `
      <div class="grid gap-gutter md:grid-cols-3">
        <dccm-state status="loading" />
        <dccm-state status="empty" emptyHeading="Aucune séance cette semaine" emptyDescription="Ton planning d’entraînement de la semaine 23 ne contient aucune séance." [emptyIcon]="seance">
          <button dccmStateEmpty hlmBtn size="sm"><ng-icon [svg]="plus" />Nouvelle séance</button>
        </dccm-state>
        <dccm-state status="error" [error]="erreur" />
      </div>`,
  }),
};

export const Squelettes: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `
      <div class="flex flex-col gap-margin">
        <dccm-state status="loading" skeleton="list" class="max-w-120" />
        <dccm-state status="loading" skeleton="cards" />
        <dccm-state status="loading" skeleton="detail" rows="2" class="max-w-120" />
      </div>`,
  }),
};
