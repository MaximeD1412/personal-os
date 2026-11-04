import { NgIcon, provideIcons } from '@ng-icons/core';
import { matTagOutline } from '@ng-icons/material-symbols/outline';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HlmBadge } from './hlm-badge';

type Args = HlmBadge & { label: string };

// Le master `Tag` : un mot-clé (lieu, rayon, sprint), pas un statut.
// `<span hlmBadge variant="tag">`, au rayon 4.
const meta: Meta<Args> = {
  title: 'Data Display/Tag',
  component: HlmBadge,
  decorators: [
    applicationConfig({ providers: [provideIcons({ matTagOutline })] }),
    moduleMetadata({ imports: [HlmBadge, NgIcon] }),
  ],
  args: { label: 'Épicerie', accent: false },
  argTypes: {
    label: { control: 'text', description: 'Le libellé, contenu projeté.' },
    variant: { control: false },
    tone: { control: false },
    dot: { control: false },
    solid: { control: false },
  },
  render: (args) => ({
    props: args,
    template: `<span hlmBadge variant="tag" [accent]="accent">{{ label }}</span>`,
  }),
};
export default meta;

type Story = StoryObj<Args>;

export const Controles: Story = { name: 'Contrôles' };

/** Les variantes de la galerie : nu, avec icône, accentué. */
export const Variantes: Story = {
  render: () => ({
    template: `
      <div class="flex items-center gap-space-lg">
        <span hlmBadge variant="tag">Frigo ét. 1</span>
        <span hlmBadge variant="tag"><ng-icon name="matTagOutline" />Épicerie</span>
        <span hlmBadge variant="tag" accent>Sprint 42</span>
      </div>
    `,
  }),
};
