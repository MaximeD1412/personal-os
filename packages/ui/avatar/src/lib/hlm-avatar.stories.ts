import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPersonOutline } from '@ng-icons/material-symbols/outline';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HlmAvatar } from './hlm-avatar';
import { HlmAvatarFallback } from './hlm-avatar-fallback';
import { HlmAvatarGroup } from './hlm-avatar-group';

type Args = HlmAvatar & { initials: string };

// Le master `Avatar` : une icône (par défaut) ou des initiales, en 24, 32 ou
// 40 px, dans trois tonalités.
const meta: Meta<Args> = {
  title: 'Data Display/Avatar',
  component: HlmAvatar,
  decorators: [
    applicationConfig({ providers: [provideIcons({ matPersonOutline })] }),
    moduleMetadata({
      imports: [HlmAvatar, HlmAvatarFallback, HlmAvatarGroup, NgIcon],
    }),
  ],
  args: { size: 'default', tone: 'primary', initials: 'M' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    tone: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'neutral'],
    },
    initials: {
      control: 'text',
      description: 'Les initiales ; vide, l’avatar porte l’icône.',
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <hlm-avatar [size]="size" [tone]="tone">
        <span hlmAvatarFallback>
          @if (initials) { {{ initials }} } @else { <ng-icon name="matPersonOutline" /> }
        </span>
      </hlm-avatar>
    `,
  }),
};
export default meta;

type Story = StoryObj<Args>;

export const Controles: Story = { name: 'Contrôles' };

/** La galerie : icône 32, initiales, 24, 40 neutre, secondary. */
export const Galerie: Story = {
  render: () => ({
    template: `
      <div class="flex items-center gap-space-lg">
        <hlm-avatar><span hlmAvatarFallback><ng-icon name="matPersonOutline" /></span></hlm-avatar>
        <hlm-avatar><span hlmAvatarFallback>M</span></hlm-avatar>
        <hlm-avatar size="sm"><span hlmAvatarFallback><ng-icon name="matPersonOutline" /></span></hlm-avatar>
        <hlm-avatar size="lg" tone="neutral"><span hlmAvatarFallback><ng-icon name="matPersonOutline" /></span></hlm-avatar>
        <hlm-avatar tone="secondary"><span hlmAvatarFallback>C</span></hlm-avatar>
      </div>
    `,
  }),
};

/** Les participants d'un événement, en groupe. */
export const Groupe: Story = {
  render: () => ({
    template: `
      <div hlmAvatarGroup>
        <hlm-avatar size="sm"><span hlmAvatarFallback>M</span></hlm-avatar>
        <hlm-avatar size="sm" tone="secondary"><span hlmAvatarFallback>C</span></hlm-avatar>
      </div>
    `,
  }),
};
