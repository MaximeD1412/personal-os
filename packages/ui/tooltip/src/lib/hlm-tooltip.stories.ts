import { NgIcon, provideIcons } from '@ng-icons/core';
import { matHomeOutline } from '@ng-icons/material-symbols/outline';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HlmTooltip } from './hlm-tooltip';

// L'infobulle n'a pas de master : elle porte le libellé d'une entrée du Rail.
// Elle s'ouvre au survol et au focus clavier.
const meta: Meta = {
  title: 'Navigation/Tooltip',
  decorators: [
    applicationConfig({ providers: [provideIcons({ matHomeOutline })] }),
    moduleMetadata({ imports: [HlmTooltip, NgIcon] }),
  ],
};
export default meta;

type Story = StoryObj;

export const Infobulle: Story = {
  render: () => ({
    template: `
      <div class="p-space-2xl">
        <a href="#" hlmTooltip="Accueil" position="right"
          class="flex h-10 w-12 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary outline-none">
          <ng-icon name="matHomeOutline" class="icon-md" aria-hidden="true" />
          <span class="sr-only">Accueil</span>
        </a>
      </div>
    `,
  }),
};
