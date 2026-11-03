import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matStarsOutline,
  matIosShareOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmButton } from '@personal-os/ui/button';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { navigationDeDemo } from '../storybook/navigation-de-demo';
import { DccmPageHeader } from './page-header';

// Le master `PageHeader` : fil d'Ariane, titre (22 px sous 768), sous-titre,
// et les actions de la page projetées.
const meta: Meta<DccmPageHeader> = {
  title: 'Navigation/PageHeader',
  component: DccmPageHeader,
  decorators: [
    applicationConfig({
      providers: [
        ...navigationDeDemo(),
        provideIcons({ matStarsOutline, matIosShareOutline }),
      ],
    }),
    moduleMetadata({ imports: [DccmPageHeader, HlmButton, NgIcon] }),
  ],
  args: {
    heading: 'Planning de repas',
    subtitle: 'Semaine du 26 mai au 1er juin',
    breadcrumb: [
      { label: 'Cuisine & Nutrition' },
      { label: 'Repas', link: '/repas/planning' },
      { label: 'Planning' },
    ],
  },
  render: (args) => ({
    props: args,
    template: `
      <dccm-page-header class="max-w-180" [heading]="heading" [subtitle]="subtitle" [breadcrumb]="breadcrumb">
        <button hlmBtn variant="secondary"><ng-icon name="matIosShareOutline" />Exporter</button>
        <button hlmBtn><ng-icon name="matStarsOutline" />Générer la semaine</button>
      </dccm-page-header>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmPageHeader>;

export const Controles: Story = { name: 'Contrôles' };

/** Sans fil d'Ariane ni actions. */
export const Simple: Story = {
  args: { breadcrumb: [], subtitle: undefined },
  render: (args) => ({
    props: args,
    template: `<dccm-page-header [heading]="heading" [subtitle]="subtitle" [breadcrumb]="breadcrumb" />`,
  }),
};
