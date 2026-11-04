import {
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { DccmCommandBarTrigger } from '../command-bar/command-bar';
import { DccmMobileHeader } from './mobile-header';

// Le master `MobileHeader` : la marque, la pastille d'état, et le bouton de
// commande projeté (`[dccmMobileHeaderCommand]`), le déclencheur compact de la
// barre de commande.
const meta: Meta<DccmMobileHeader> = {
  title: 'Navigation/MobileHeader',
  component: DccmMobileHeader,
  decorators: [
    moduleMetadata({ imports: [DccmMobileHeader, DccmCommandBarTrigger] }),
  ],
  args: { status: { label: 'API joignable', tone: 'success' } },
  render: (args) => ({
    props: args,
    template: `
      <dccm-mobile-header class="w-97.5" [status]="status">
        <button dccmMobileHeaderCommand dccmCommandBarTrigger compact label="Que veux-tu faire ?"></button>
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

/** Sans bouton projeté. */
export const SansCommande: Story = {
  name: 'Sans commande',
  render: (args) => ({
    props: args,
    template: `<dccm-mobile-header class="w-97.5" [status]="status" />`,
  }),
};
