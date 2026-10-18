import { NgIcon, provideIcons } from '@ng-icons/core';
import { matTerminalOutline } from '@ng-icons/material-symbols/outline';
import { HlmButton } from '@personal-os/ui/button';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmMobileHeader } from './mobile-header';

// Le master `MobileHeader` : la marque, la pastille d'état, et le bouton de
// commande projeté (`[dccmMobileHeaderCommand]`, CMD-3).
const meta: Meta<DccmMobileHeader> = {
  title: 'Navigation/MobileHeader',
  component: DccmMobileHeader,
  decorators: [
    applicationConfig({ providers: [provideIcons({ matTerminalOutline })] }),
    moduleMetadata({ imports: [DccmMobileHeader, HlmButton, NgIcon] }),
  ],
  args: { status: { label: 'API joignable', tone: 'success' } },
  render: (args) => ({
    props: args,
    template: `
      <dccm-mobile-header class="w-97.5" [status]="status">
        <button dccmMobileHeaderCommand hlmBtn variant="secondary" size="icon-lg" aria-label="Barre de commande">
          <ng-icon name="matTerminalOutline" />
        </button>
      </dccm-mobile-header>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmMobileHeader>;

export const Controles: Story = { name: 'Contrôles' };

export const ApiInjoignable: Story = {
  name: 'API injoignable',
  args: { status: { label: 'API injoignable', tone: 'error' } },
};

/** Sans bouton projeté : ce que montre le tableau de bord avant CMD-3. */
export const SansCommande: Story = {
  name: 'Sans commande',
  render: (args) => ({
    props: args,
    template: `<dccm-mobile-header class="w-97.5" [status]="status" />`,
  }),
};
