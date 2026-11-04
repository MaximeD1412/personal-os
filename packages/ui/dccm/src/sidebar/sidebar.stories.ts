import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import {
  GROUPES_DE_DEMO,
  navigationDeDemo,
  PIED_DE_DEMO,
} from '../storybook/navigation-de-demo';
import { DccmSidebar } from './sidebar';

// Les masters `Sidebar` (240 px) et `Rail` (72 px). L'écran affiché ici est
// l'Agenda ; Gestion, Documentation, Intégrations et Aide sont « À venir ».
const meta: Meta<DccmSidebar> = {
  title: 'Navigation/Sidebar',
  component: DccmSidebar,
  decorators: [
    applicationConfig({ providers: navigationDeDemo() }),
    moduleMetadata({ imports: [DccmSidebar] }),
  ],
  args: {
    groups: GROUPES_DE_DEMO,
    footer: PIED_DE_DEMO,
    variant: 'full',
    status: { label: 'API joignable', tone: 'success' },
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['full', 'rail'] },
  },
  render: (args) => ({
    props: args,
    template: `
      <div class="h-225">
        <dccm-sidebar [groups]="groups" [footer]="footer" [variant]="variant" [status]="status" />
      </div>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmSidebar>;

export const Sidebar: Story = {};

/** Le Rail : libellés en infobulle (survol ou focus), groupes séparés d'un filet. */
export const Rail: Story = { args: { variant: 'rail' } };

/** La pastille quand la sonde de santé échoue. */
export const ApiInjoignable: Story = {
  name: 'API injoignable',
  args: { status: { label: 'API injoignable', tone: 'error' } },
};
