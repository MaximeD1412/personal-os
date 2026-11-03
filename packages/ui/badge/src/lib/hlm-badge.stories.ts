import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matCheckCircleOutline,
  matErrorOutline,
  matInfoOutline,
  matScheduleOutline,
  matSellOutline,
  matTagOutline,
} from '@ng-icons/material-symbols/outline';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HlmBadge } from './hlm-badge';

type Args = HlmBadge & { label: string };

// Le master `Badge` de la planche 03 Data Display : un statut en capsule. La
// tonalité dit un sens (table « Les tonalités de badge » de
// docs/design-system.md) ; un libellé ou une icône l'accompagnent toujours.
const meta: Meta<Args> = {
  title: 'Data Display/Badge',
  component: HlmBadge,
  decorators: [
    applicationConfig({
      providers: [
        provideIcons({
          matCheckCircleOutline,
          matErrorOutline,
          matInfoOutline,
          matScheduleOutline,
          matSellOutline,
          matTagOutline,
        }),
      ],
    }),
    moduleMetadata({ imports: [HlmBadge, NgIcon] }),
  ],
  args: { label: 'En ligne', tone: 'success', dot: false },
  argTypes: {
    label: { control: 'text', description: 'Le libellé, contenu projeté.' },
    tone: {
      control: 'inline-radio',
      options: ['info', 'success', 'warning', 'error', 'neutral'],
    },
    variant: { control: false },
    accent: { control: false },
    solid: { control: false },
  },
  render: (args) => ({
    props: args,
    template: `<span hlmBadge [tone]="tone" [dot]="dot">{{ label }}</span>`,
  }),
};
export default meta;

type Story = StoryObj<Args>;

export const Controles: Story = { name: 'Contrôles' };

/** Les cinq tonalités, nues, avec point et avec icône (galerie « Badge tones »). */
export const Tonalites: Story = {
  name: 'Tonalités',
  render: () => ({
    props: {
      tonalites: [
        { tone: 'success', sens: 'Validé, en ligne', libelle: 'En ligne', icone: 'matCheckCircleOutline' },
        { tone: 'warning', sens: 'En attente, bientôt', libelle: 'En attente', icone: 'matScheduleOutline' },
        { tone: 'error', sens: 'Alerte, dégradé', libelle: 'Dégradé', icone: 'matErrorOutline' },
        { tone: 'info', sens: 'Information', libelle: 'Info', icone: 'matInfoOutline' },
        { tone: 'neutral', sens: 'Neutre', libelle: 'Neutre', icone: 'matSellOutline' },
      ],
    },
    template: `
      <div class="grid grid-cols-[10rem_repeat(3,max-content)] items-center gap-x-space-lg gap-y-space-md">
        @for (t of tonalites; track t.tone) {
          <span class="text-label-micro text-outline uppercase">{{ t.tone }} · {{ t.sens }}</span>
          <span hlmBadge [tone]="t.tone">{{ t.libelle }}</span>
          <span hlmBadge [tone]="t.tone" dot>Avec point</span>
          <span hlmBadge [tone]="t.tone"><ng-icon [name]="t.icone" />Icône</span>
        }
      </div>
    `,
  }),
};

/** Le compteur de 16 px, dans la tonalité de son contexte, ou plein. */
export const Compteurs: Story = {
  render: () => ({
    template: `
      <div class="flex items-center gap-space-lg">
        <span hlmBadge variant="counter">3</span>
        <span hlmBadge variant="counter" tone="error">8</span>
        <span hlmBadge variant="counter" solid>12</span>
      </div>
    `,
  }),
};

/** Un badge en situation : la date limite d'un article du stock. */
export const Usage: Story = {
  render: () => ({
    template: `
      <ul class="flex w-80 flex-col gap-space-sm text-body-dense text-on-surface">
        <li class="flex items-center justify-between">Blancs de poulet <span hlmBadge tone="success">DLC J+8</span></li>
        <li class="flex items-center justify-between">Crème fraîche <span hlmBadge tone="warning" dot>Périme J-2</span></li>
        <li class="flex items-center justify-between">Yaourts <span hlmBadge tone="error"><ng-icon name="matErrorOutline" />Périmé</span></li>
      </ul>
    `,
  }),
};
